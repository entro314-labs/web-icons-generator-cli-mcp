#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import prompts from 'prompts';
import path from 'path';
import { IconGenerator } from './generator.js';
import { FrameworkDetector, validateSourceFile, findAppIcon } from './utils.js';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import type { GenerationMode } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getPackageVersion(): Promise<string> {
  try {
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf-8'));
    return packageJson.version;
  } catch {
    return '1.0.0';
  }
}

async function main() {
  const version = await getPackageVersion();

  const program = new Command();

  program
    .name('create-web-icons')
    .description('Generate all required web app icons and files from a single source image')
    .version(version)
    .argument('[source]', 'Source image file (SVG, PNG, or JPG)')
    .option('-o, --output <dir>', 'Output directory (auto-detected if not specified)')
    .option('-c, --color <color>', 'Color for Safari pinned tab icon (default: #5bbad5)', '#5bbad5')
    .option('-m, --mode <mode>', 'Generation mode: traditional (public/), nextjs (app/), or auto-detect', 'auto')
    .option('--mcp', 'Run as MCP server (for Claude Desktop integration)')
    .action(async (source: string | undefined, options) => {
      // If --mcp flag is provided, start MCP server instead
      if (options.mcp) {
        const { spawn } = await import('child_process');
        const mcpPath = new URL('./mcp.js', import.meta.url).pathname;
        spawn('node', [mcpPath], { stdio: 'inherit' });
        return;
      }

      try {
        console.log(chalk.bold.cyan('\n🎨 Web Icons Generator\n'));

        const cwd = process.cwd();
        let sourcePath = source;

        // Try to auto-detect app-icon.svg or app-icon.png if no source provided
        if (!sourcePath) {
          const autoDetected = await findAppIcon(cwd);
          if (autoDetected) {
            console.log(chalk.green(`✓ Found ${chalk.bold(path.basename(autoDetected))} in current directory`));
            sourcePath = autoDetected;
          } else {
            // Prompt for source file
            const response = await prompts({
              type: 'text',
              name: 'source',
              message: 'Source image path (or place app-icon.svg/app-icon.png in current directory):',
              validate: (value) => value.trim() !== '' || 'Source path is required',
            });

            if (!response.source) {
              console.log(chalk.yellow('\n⚠️  Operation cancelled'));
              process.exit(0);
            }

            sourcePath = response.source;
          }
        }

        // Resolve absolute path
        sourcePath = path.resolve(cwd, sourcePath!);

        // Validate source file
        const validationSpinner = ora('Validating source file...').start();
        try {
          await validateSourceFile(sourcePath);
          validationSpinner.succeed(chalk.green('Source file validated'));
        } catch (error) {
          validationSpinner.fail(chalk.red('Validation failed'));
          throw error;
        }

        // Detect framework and output directory
        const detector = new FrameworkDetector(cwd);
        const framework = await detector.detect();
        const hasAppRouter = await detector.hasAppRouter();

        // Determine generation mode
        let mode: GenerationMode = options.mode as GenerationMode;

        // Validate mode option
        if (!['traditional', 'nextjs', 'auto'].includes(mode)) {
          console.log(chalk.yellow(`⚠️  Invalid mode "${mode}". Using "auto" instead.`));
          mode = 'auto';
        }

        let outputDir: string;
        if (options.output) {
          outputDir = path.resolve(cwd, options.output);

          // If output is explicitly set and mode is auto, determine mode from path
          if (mode === 'auto') {
            const outputBasename = path.basename(outputDir);
            if (outputBasename === 'app' || outputDir.includes('/app')) {
              mode = 'nextjs';
            } else {
              mode = 'traditional';
            }
          }
        } else {
          // Auto-detect output directory based on mode and framework
          if (mode === 'auto' && hasAppRouter && framework?.name === 'Next.js') {
            // Suggest Next.js App Router mode
            const response = await prompts({
              type: 'select',
              name: 'selectedMode',
              message: 'Next.js App Router detected. Choose generation mode:',
              choices: [
                { title: '🚀 Next.js App Router (app/) - Recommended', value: 'nextjs', description: 'Auto-linked icons in app/ directory' },
                { title: '📁 Traditional (public/)', value: 'traditional', description: 'Manual HTML integration required' },
              ],
              initial: 0,
            });

            mode = response.selectedMode || 'nextjs';
          } else if (mode === 'auto') {
            mode = 'traditional';
          }

          // Set output directory based on mode
          if (mode === 'nextjs' && hasAppRouter) {
            outputDir = await detector.getAppDir() || await detector.getPublicDir();
          } else {
            outputDir = await detector.getPublicDir();
          }

          if (framework) {
            const targetDir = mode === 'nextjs' && hasAppRouter ? 'app' : framework.publicDir;
            console.log(chalk.blue(`✓ Detected ${framework.name} → using ${chalk.bold(targetDir)}/ directory (${mode} mode)`));
          } else {
            console.log(chalk.yellow('⚠️  No framework detected → using public/ directory'));
          }

          const confirm = await prompts({
            type: 'confirm',
            name: 'useDetected',
            message: `Generate icons in ${chalk.bold(path.relative(cwd, outputDir) || '.')}/?`,
            initial: true,
          });

          if (!confirm.useDetected) {
            const customDir = await prompts({
              type: 'text',
              name: 'dir',
              message: 'Enter output directory:',
              initial: '.',
            });

            if (!customDir.dir) {
              console.log(chalk.yellow('\n⚠️  Operation cancelled'));
              process.exit(0);
            }

            outputDir = path.resolve(cwd, customDir.dir);
          }
        }

        // Generate icons
        const generateSpinner = ora('Generating icons...').start();

        const generator = new IconGenerator({
          sourcePath,
          outputDir,
          projectRoot: cwd,
          color: options.color,
          mode: mode,
        });

        await generator.generate();
        generateSpinner.succeed(chalk.green('Icons generated successfully!'));

        const actualMode = generator.getMode();
        const outputDirRelative = path.relative(cwd, outputDir) || '.';
        const instructionsFile = path.relative(cwd, generator.getInstructionsFilePath());

        // Summary - different for each mode
        console.log(chalk.bold.green('\n✨ Success! Generated files:\n'));

        if (actualMode === 'nextjs') {
          console.log(chalk.gray('  ├── favicon.ico (32×32)'));
          console.log(chalk.gray('  ├── icon.png (512×512) - auto-linked by Next.js'));
          console.log(chalk.gray('  ├── apple-icon.png (180×180) - auto-linked by Next.js'));
          console.log(chalk.gray('  ├── apple-touch-icon.png (180×180) - for compatibility'));
          if (sourcePath.toLowerCase().endsWith('.svg')) {
            console.log(chalk.gray('  ├── icon.svg (scalable) - auto-linked by Next.js'));
          }
          console.log(chalk.gray(`  └── In ${chalk.bold(outputDirRelative)}/\n`));

          console.log(chalk.bold.cyan('📋 Next.js App Router Mode:\n'));
          console.log(chalk.white('✓ Icons are automatically linked by Next.js'));
          console.log(chalk.white('✓ No manual <head> tags needed!'));
          console.log(chalk.white(`✓ Integration guide: ${chalk.bold(instructionsFile)}\n`));
        } else {
          console.log(chalk.gray('  ├── favicon.ico (32×32)'));
          if (sourcePath.toLowerCase().endsWith('.svg')) {
            console.log(chalk.gray('  ├── icon.svg (scalable)'));
          }
          console.log(chalk.gray('  ├── icon-192.png (192×192)'));
          console.log(chalk.gray('  ├── icon-512.png (512×512)'));
          console.log(chalk.gray('  ├── apple-touch-icon.png (180×180)'));
          console.log(chalk.gray('  ├── icon-maskable.png (512×512, with padding)'));
          if (sourcePath.toLowerCase().endsWith('.svg')) {
            console.log(chalk.gray('  ├── safari-pinned-tab.svg (monochrome)'));
          }
          console.log(chalk.gray('  ├── site.webmanifest'));
          console.log(chalk.gray(`  └── In ${chalk.bold(outputDirRelative)}/\n`));

          console.log(chalk.bold.cyan('📋 Next steps:\n'));
          console.log(chalk.white(`1. Review integration guide: ${chalk.bold(instructionsFile)}`));
          console.log(chalk.white(`2. Copy HTML snippet to your <head> tag`));
          console.log(chalk.white('3. Deploy and test on different devices!\n'));
        }

        // AI-ready prompt
        const aiPrompt = generator.generateAIPrompt(framework?.name || null, outputDirRelative);
        console.log(chalk.bold.magenta('🤖 AI Assistant Prompt:\n'));
        console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.white(aiPrompt));
        console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
        console.log(chalk.dim('💡 Copy the above prompt to ask an AI assistant to verify your setup\n'));

      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
        } else {
          console.error(chalk.red('\n❌ An unexpected error occurred\n'));
        }
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main();
