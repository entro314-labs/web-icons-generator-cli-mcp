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

        let outputDir: string;
        if (options.output) {
          outputDir = path.resolve(cwd, options.output);
        } else {
          outputDir = await detector.getPublicDir();

          if (framework) {
            console.log(chalk.blue(`✓ Detected ${framework.name} → using ${chalk.bold(framework.publicDir)}/ directory`));
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

        try {
          const generator = new IconGenerator({
            sourcePath,
            outputDir,
            color: options.color,
          });

          await generator.generate();
          generateSpinner.succeed(chalk.green('Icons generated successfully!'));
        } catch (error) {
          generateSpinner.fail(chalk.red('Generation failed'));
          throw error;
        }

        // Summary
        console.log(chalk.bold.green('\n✨ Success! Generated files:\n'));
        console.log(chalk.gray('  ├── favicon.ico (32×32)'));
        console.log(chalk.gray('  ├── icon.svg (scalable)'));
        console.log(chalk.gray('  ├── icon-192.png (192×192)'));
        console.log(chalk.gray('  ├── icon-512.png (512×512)'));
        console.log(chalk.gray('  ├── apple-touch-icon.png (180×180)'));
        console.log(chalk.gray('  ├── icon-maskable.png (512×512, with padding)'));
        console.log(chalk.gray('  ├── safari-pinned-tab.svg (monochrome)'));
        console.log(chalk.gray('  ├── site.webmanifest'));
        console.log(chalk.gray('  └── html-snippet.txt\n'));

        console.log(chalk.bold.cyan('📋 Next steps:\n'));
        console.log(chalk.white(`1. Review generated files in ${chalk.bold(path.relative(cwd, outputDir) || '.')}/`));
        console.log(chalk.white(`2. Copy HTML snippet from ${chalk.bold('html-snippet.txt')} to your <head> tag`));
        console.log(chalk.white('3. Deploy and test on different devices!\n'));

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
