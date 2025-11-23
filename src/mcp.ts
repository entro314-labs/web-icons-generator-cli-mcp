#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import path from 'path';
import { IconGenerator } from './generator.js';
import { FrameworkDetector, validateSourceFile, findAppIcon } from './utils.js';
import { promises as fs } from 'fs';

// Tool input schemas
const GenerateWebIconsSchema = z.object({
  sourcePath: z.string().describe('Path to source image file (SVG, PNG, or JPG)'),
  outputDir: z.string().optional().describe('Output directory (auto-detected if not provided)'),
  color: z.string().optional().default('#5bbad5').describe('Color for Safari pinned tab icon'),
  projectPath: z.string().optional().describe('Project root path for framework detection'),
  mode: z.enum(['traditional', 'nextjs', 'auto']).optional().default('auto').describe('Generation mode: traditional (public/), nextjs (app/), or auto-detect'),
  minimal: z.boolean().optional().default(false).describe('Generate minimal essential icon set only (default: full 2025 standards set)'),
  // PWA manifest options
  appName: z.string().optional().describe('Full app name for PWA manifest'),
  appShortName: z.string().optional().describe('Short app name for PWA manifest (max 12 chars)'),
  themeColor: z.string().optional().default('#ffffff').describe('Theme color for browser UI and PWA'),
  backgroundColor: z.string().optional().default('#ffffff').describe('Background color for PWA splash screen'),
});

const AutoGenerateIconsSchema = z.object({
  projectPath: z.string().describe('Project root directory to search for app-icon.svg or app-icon.png'),
  color: z.string().optional().default('#5bbad5').describe('Color for Safari pinned tab icon'),
  mode: z.enum(['traditional', 'nextjs', 'auto']).optional().default('auto').describe('Generation mode: traditional (public/), nextjs (app/), or auto-detect'),
  minimal: z.boolean().optional().default(false).describe('Generate minimal essential icon set only (default: full 2025 standards set)'),
  // PWA manifest options
  appName: z.string().optional().describe('Full app name for PWA manifest'),
  appShortName: z.string().optional().describe('Short app name for PWA manifest (max 12 chars)'),
  themeColor: z.string().optional().default('#ffffff').describe('Theme color for browser UI and PWA'),
  backgroundColor: z.string().optional().default('#ffffff').describe('Background color for PWA splash screen'),
});

const CheckIconsStatusSchema = z.object({
  projectPath: z.string().describe('Project root directory to check'),
});

const IntegrateIconsHTMLSchema = z.object({
  projectPath: z.string().describe('Project root directory'),
  htmlPath: z.string().optional().describe('Optional: specific HTML file path relative to project root'),
  color: z.string().optional().default('#5bbad5').describe('Color for Safari pinned tab icon'),
});

// Required icon files for traditional mode (2025 standards)
const REQUIRED_ICONS_TRADITIONAL = [
  'favicon.ico',
  'favicon.svg',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'favicon-96x96.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'android-chrome-maskable-512x512.png',
  'apple-touch-icon.png',
  'safari-pinned-tab.svg',
  'site.webmanifest',
];

// Required icon files for Next.js App Router mode
const REQUIRED_ICONS_NEXTJS = [
  'favicon.ico',
  'icon.svg',
  'icon.png',
  'apple-icon.png',
  'apple-touch-icon.png',
];

// Create server instance
const server = new Server(
  {
    name: 'web-icons-generator',
    version: '1.2.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Error handling
server.onerror = (error) => console.error('[MCP Error]', error);

// Tool handlers
{
  const setupToolHandlers = () => {
    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_web_icons',
          description: 'Generate all required web app icons from a source image (SVG, PNG, or JPG) following 2025 favicon standards. Creates multi-resolution ICO (16/32/48), individual PNG favicons, Android Chrome icons (192/512/maskable), Apple touch icon, Safari pinned tab, and PWA manifest. Supports both traditional (public/) and Next.js App Router (app/) modes.',
          inputSchema: {
            type: 'object',
            properties: {
              sourcePath: {
                type: 'string',
                description: 'Path to source image file (SVG, PNG, or JPG)',
              },
              outputDir: {
                type: 'string',
                description: 'Output directory (auto-detected based on framework if not provided)',
              },
              color: {
                type: 'string',
                description: 'Hex color for Safari pinned tab icon (default: #5bbad5)',
              },
              projectPath: {
                type: 'string',
                description: 'Project root path for framework detection',
              },
              mode: {
                type: 'string',
                enum: ['traditional', 'nextjs', 'auto'],
                description: 'Generation mode: traditional (public/ with manual HTML), nextjs (app/ with auto-linking), or auto-detect (default)',
              },
              minimal: {
                type: 'boolean',
                description: 'Generate minimal essential icon set only (default: false for full 2025 standards set)',
              },
              appName: {
                type: 'string',
                description: 'Full app name for PWA manifest',
              },
              appShortName: {
                type: 'string',
                description: 'Short app name for PWA manifest (max 12 chars)',
              },
              themeColor: {
                type: 'string',
                description: 'Theme color for browser UI and PWA (default: #ffffff)',
              },
              backgroundColor: {
                type: 'string',
                description: 'Background color for PWA splash screen (default: #ffffff)',
              },
            },
            required: ['sourcePath'],
          },
        },
        {
          name: 'auto_generate_icons',
          description: 'Automatically find app-icon.svg or app-icon.png in project directory and generate all web icons following 2025 standards. Creates multi-resolution ICO, PNG favicons (16/32/48/96), Android Chrome icons, Apple touch icon, and PWA manifest. Perfect for zero-config icon generation.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Project root directory to search for app-icon.svg or app-icon.png',
              },
              color: {
                type: 'string',
                description: 'Hex color for Safari pinned tab icon (default: #5bbad5)',
              },
              mode: {
                type: 'string',
                enum: ['traditional', 'nextjs', 'auto'],
                description: 'Generation mode: traditional (public/ with manual HTML), nextjs (app/ with auto-linking), or auto-detect (default)',
              },
              minimal: {
                type: 'boolean',
                description: 'Generate minimal essential icon set only (default: false for full 2025 standards set)',
              },
              appName: {
                type: 'string',
                description: 'Full app name for PWA manifest',
              },
              appShortName: {
                type: 'string',
                description: 'Short app name for PWA manifest (max 12 chars)',
              },
              themeColor: {
                type: 'string',
                description: 'Theme color for browser UI and PWA (default: #ffffff)',
              },
              backgroundColor: {
                type: 'string',
                description: 'Background color for PWA splash screen (default: #ffffff)',
              },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'check_icons_status',
          description: 'Check which web icons exist in a project and which are missing. Returns detailed status of all required icon files.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Project root directory to check for icons',
              },
            },
            required: ['projectPath'],
          },
        },
        {
          name: 'integrate_icons_html',
          description: 'Add or update icon link tags in HTML files. Automatically detects HTML entry points (index.html, layout files) and inserts proper favicon, PWA manifest, and Apple icon tags.',
          inputSchema: {
            type: 'object',
            properties: {
              projectPath: {
                type: 'string',
                description: 'Project root directory',
              },
              htmlPath: {
                type: 'string',
                description: 'Optional: specific HTML file path relative to project root. If not provided, auto-detects index.html or framework layout files.',
              },
              color: {
                type: 'string',
                description: 'Hex color for Safari pinned tab icon (default: #5bbad5)',
              },
            },
            required: ['projectPath'],
          },
        },
      ] satisfies Tool[],
    }));

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'generate_web_icons':
            return await handleGenerateWebIcons(request.params.arguments);
          case 'auto_generate_icons':
            return await handleAutoGenerateIcons(request.params.arguments);
          case 'check_icons_status':
            return await handleCheckIconsStatus(request.params.arguments);
          case 'integrate_icons_html':
            return await handleIntegrateIconsHTML(request.params.arguments);
          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  };

  setupToolHandlers();
}

// Tool implementation functions
async function handleGenerateWebIcons(args: unknown) {
    const parsed = GenerateWebIconsSchema.parse(args);
    const projectPath = parsed.projectPath || process.cwd();

    // Resolve absolute paths
    const sourcePath = path.resolve(projectPath, parsed.sourcePath);

    // Validate source file
    await validateSourceFile(sourcePath);

    // Detect framework and determine output directory
    const detector = new FrameworkDetector(projectPath);
    const framework = await detector.detect();
    const hasAppRouter = await detector.hasAppRouter();

    let mode = parsed.mode || 'auto';
    let outputDir: string;

    if (parsed.outputDir) {
      outputDir = path.resolve(projectPath, parsed.outputDir);
      // If output is explicitly set and mode is auto, determine mode from path
      if (mode === 'auto') {
        const outputBasename = path.basename(outputDir);
        mode = (outputBasename === 'app' || outputDir.includes('/app')) ? 'nextjs' : 'traditional';
      }
    } else {
      // Auto-detect output directory based on mode and framework
      if (mode === 'auto' && hasAppRouter && framework?.name === 'Next.js') {
        mode = 'nextjs';
      } else if (mode === 'auto') {
        mode = 'traditional';
      }

      // Set output directory based on mode
      if (mode === 'nextjs' && hasAppRouter) {
        outputDir = await detector.getAppDir() || await detector.getPublicDir();
      } else {
        outputDir = await detector.getPublicDir();
      }
    }

    // Generate icons
    const isMinimal = parsed.minimal || false;
    const generator = new IconGenerator({
      sourcePath,
      outputDir,
      projectRoot: projectPath,
      color: parsed.color,
      mode: mode as 'traditional' | 'nextjs' | 'auto',
      minimal: isMinimal,
      appName: parsed.appName,
      appShortName: parsed.appShortName,
      themeColor: parsed.themeColor,
      backgroundColor: parsed.backgroundColor,
    });

    await generator.generate();
    const actualMode = generator.getMode();
    const isSvgSource = sourcePath.toLowerCase().endsWith('.svg');

    const modeLabel = isMinimal ? ' (Minimal)' : ' (Full 2025 Standards)';
    const frameworkInfo = framework
      ? `Detected ${framework.name} → using ${actualMode === 'nextjs' ? 'app' : framework.publicDir}/ directory (${actualMode} mode)${modeLabel}`
      : `No framework detected → using public/ directory (${actualMode} mode)${modeLabel}`;

    const outputDirRelative = path.relative(projectPath, outputDir);
    const instructionsFile = path.relative(projectPath, generator.getInstructionsFilePath());
    const aiPrompt = generator.generateAIPrompt(framework?.name || null, outputDirRelative);

    let htmlSnippet: string;
    let filesList: string;

    if (actualMode === 'nextjs') {
      htmlSnippet = `Next.js App Router Mode - Icons are automatically linked!\n\nGenerated files in ${outputDirRelative}/:\n- favicon.ico (32×32)\n- icon.png (512×512) - auto-linked\n- apple-icon.png (180×180) - auto-linked\n${isSvgSource ? '- icon.svg - auto-linked' : ''}\n\nNo manual <link> tags needed!`;
      filesList = `- favicon.ico (32×32)\n- icon.png (512×512)\n- apple-icon.png (180×180)\n- apple-touch-icon.png (180×180)${isSvgSource ? '\n- icon.svg (scalable)' : ''}`;
    } else if (isMinimal) {
      htmlSnippet = `<!-- Favicons (Minimal) -->\n${isSvgSource ? '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n' : ''}<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">\n<link rel="icon" href="/favicon.ico" sizes="48x48">\n\n<!-- Apple Touch Icon -->\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n\n<!-- Web App Manifest (PWA) -->\n<link rel="manifest" href="/site.webmanifest">\n<meta name="theme-color" content="${parsed.themeColor || '#ffffff'}">`;
      filesList = `- favicon.ico (multi-res: 16×16, 32×32, 48×48)\n- favicon-48x48.png${isSvgSource ? '\n- favicon.svg (scalable)' : ''}\n- android-chrome-192x192.png, android-chrome-512x512.png\n- apple-touch-icon.png (180×180)\n- site.webmanifest (PWA manifest)`;
    } else {
      htmlSnippet = `<!-- Favicons -->\n${isSvgSource ? '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n' : ''}<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n<link rel="icon" href="/favicon.ico" sizes="48x48">\n\n<!-- Apple Touch Icon -->\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n\n<!-- Web App Manifest (PWA) -->\n<link rel="manifest" href="/site.webmanifest">\n<meta name="theme-color" content="${parsed.themeColor || '#ffffff'}">\n\n${isSvgSource ? `<!-- Safari Pinned Tab -->\n<link rel="mask-icon" href="/safari-pinned-tab.svg" color="${parsed.color || '#5bbad5'}">` : ''}`;
      filesList = `- favicon.ico (multi-res: 16×16, 32×32, 48×48)\n- favicon-16x16.png, favicon-32x32.png, favicon-48x48.png\n- favicon-96x96.png (Google search results)${isSvgSource ? '\n- favicon.svg (scalable)' : ''}\n- android-chrome-192x192.png, android-chrome-512x512.png\n- android-chrome-maskable-512x512.png (PWA maskable)\n- apple-touch-icon.png (180×180)${isSvgSource ? '\n- safari-pinned-tab.svg (monochrome)' : ''}\n- site.webmanifest (PWA manifest)`;
    }

    const minimalTip = isMinimal ? '\n\n💡 Tip: Run without minimal flag for full 2025 standards compliance' : '';

    return {
      content: [
        {
          type: 'text',
          text: `✨ Successfully generated web icons!\n\n${frameworkInfo}\nOutput: ${outputDirRelative}/\n\nGenerated files:\n${filesList}\n- Integration guide: ${instructionsFile}\n\n📝 ${actualMode === 'nextjs' ? 'Next.js Integration:' : 'Add these tags to your HTML <head>:'}\n\n${htmlSnippet}${minimalTip}\n\n🤖 AI Assistant Prompt:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${aiPrompt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        },
      ],
    };
}

async function handleAutoGenerateIcons(args: unknown) {
    const parsed = AutoGenerateIconsSchema.parse(args);
    const projectPath = path.resolve(parsed.projectPath);

    // Find app-icon
    const appIconPath = await findAppIcon(projectPath);
    if (!appIconPath) {
      throw new Error('No app-icon.svg or app-icon.png found in project directory. Please create one first.');
    }

    // Detect framework and determine output directory
    const detector = new FrameworkDetector(projectPath);
    const framework = await detector.detect();
    const hasAppRouter = await detector.hasAppRouter();

    let mode = parsed.mode || 'auto';
    let outputDir: string;

    // Auto-detect output directory based on mode and framework
    if (mode === 'auto' && hasAppRouter && framework?.name === 'Next.js') {
      mode = 'nextjs';
    } else if (mode === 'auto') {
      mode = 'traditional';
    }

    // Set output directory based on mode
    if (mode === 'nextjs' && hasAppRouter) {
      outputDir = await detector.getAppDir() || await detector.getPublicDir();
    } else {
      outputDir = await detector.getPublicDir();
    }

    // Generate icons
    const isMinimal = parsed.minimal || false;
    const generator = new IconGenerator({
      sourcePath: appIconPath,
      outputDir,
      projectRoot: projectPath,
      color: parsed.color,
      mode: mode as 'traditional' | 'nextjs' | 'auto',
      minimal: isMinimal,
      appName: parsed.appName,
      appShortName: parsed.appShortName,
      themeColor: parsed.themeColor,
      backgroundColor: parsed.backgroundColor,
    });

    await generator.generate();
    const actualMode = generator.getMode();
    const isSvgSource = appIconPath.toLowerCase().endsWith('.svg');

    const modeLabel = isMinimal ? ' (Minimal)' : ' (Full 2025 Standards)';
    const frameworkInfo = framework
      ? `Detected ${framework.name} → using ${actualMode === 'nextjs' ? 'app' : framework.publicDir}/ directory (${actualMode} mode)${modeLabel}`
      : `No framework detected → using public/ directory (${actualMode} mode)${modeLabel}`;

    const outputDirRelative = path.relative(projectPath, outputDir);
    const instructionsFile = path.relative(projectPath, generator.getInstructionsFilePath());
    const aiPrompt = generator.generateAIPrompt(framework?.name || null, outputDirRelative);

    let htmlSnippet: string;
    let filesList: string;

    if (actualMode === 'nextjs') {
      htmlSnippet = `Next.js App Router Mode - Icons are automatically linked!\n\nNo manual <link> tags needed!`;
      filesList = `- favicon.ico (32×32)\n- icon.png (512×512)\n- apple-icon.png, apple-touch-icon.png (180×180)${isSvgSource ? '\n- icon.svg (scalable)' : ''}`;
    } else if (isMinimal) {
      htmlSnippet = `<!-- Favicons (Minimal) -->\n${isSvgSource ? '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n' : ''}<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">\n<link rel="icon" href="/favicon.ico" sizes="48x48">\n\n<!-- Apple Touch Icon -->\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n\n<!-- Web App Manifest (PWA) -->\n<link rel="manifest" href="/site.webmanifest">\n<meta name="theme-color" content="${parsed.themeColor || '#ffffff'}">`;
      filesList = `- favicon.ico (multi-res), favicon-48x48.png${isSvgSource ? ', favicon.svg' : ''}\n- android-chrome icons (192, 512)\n- apple-touch-icon.png (180×180)\n- site.webmanifest (PWA manifest)`;
    } else {
      htmlSnippet = `<!-- Favicons -->\n${isSvgSource ? '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n' : ''}<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">\n<link rel="icon" href="/favicon.ico" sizes="48x48">\n\n<!-- Apple Touch Icon -->\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n\n<!-- Web App Manifest (PWA) -->\n<link rel="manifest" href="/site.webmanifest">\n<meta name="theme-color" content="${parsed.themeColor || '#ffffff'}">`;
      filesList = `- favicon.ico (multi-res), favicon PNGs (16, 32, 48, 96)${isSvgSource ? ', favicon.svg' : ''}\n- android-chrome icons (192, 512, maskable)\n- apple-touch-icon.png (180×180)${isSvgSource ? ', safari-pinned-tab.svg' : ''}\n- site.webmanifest (PWA manifest)`;
    }

    const minimalTip = isMinimal ? '\n\n💡 Tip: Run without minimal flag for full 2025 standards compliance' : '';

    return {
      content: [
        {
          type: 'text',
          text: `✨ Successfully generated web icons!\n\nFound: ${path.basename(appIconPath)}\n${frameworkInfo}\nOutput: ${outputDirRelative}/\n\nGenerated files:\n${filesList}\n- Integration guide: ${instructionsFile}\n\n📝 ${actualMode === 'nextjs' ? 'Next.js Integration:' : 'Add these tags to your HTML <head>:'}\n\n${htmlSnippet}${minimalTip}\n\n🤖 AI Assistant Prompt:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${aiPrompt}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        },
      ],
    };
}

async function handleCheckIconsStatus(args: unknown) {
    const parsed = CheckIconsStatusSchema.parse(args);
    const projectPath = path.resolve(parsed.projectPath);

    // Detect framework to know where to look
    const detector = new FrameworkDetector(projectPath);
    const framework = await detector.detect();
    const hasAppRouter = await detector.hasAppRouter();
    const publicDir = await detector.getPublicDir();
    const appDir = await detector.getAppDir();

    // Determine mode and check directory
    const isNextjsMode = hasAppRouter && framework?.name === 'Next.js';
    const checkDir = isNextjsMode && appDir ? appDir : publicDir;
    const requiredIcons = isNextjsMode ? REQUIRED_ICONS_NEXTJS : REQUIRED_ICONS_TRADITIONAL;
    const modeName = isNextjsMode ? 'Next.js App Router' : 'Traditional';

    // Check for app-icon source
    const appIcon = await findAppIcon(projectPath);

    // Check which required icons exist
    const iconStatus = await Promise.all(
      requiredIcons.map(async (icon: string) => {
        const iconPath = path.join(checkDir, icon);
        try {
          await fs.access(iconPath);
          return { name: icon, exists: true, path: iconPath };
        } catch {
          return { name: icon, exists: false, path: iconPath };
        }
      })
    );

    const existing = iconStatus.filter((i: { exists: boolean }) => i.exists);
    const missing = iconStatus.filter((i: { exists: boolean }) => !i.exists);

    let statusText = `📊 Icon Status for ${projectPath}\n\n`;

    if (framework) {
      statusText += `Framework: ${framework.name}\n`;
    }
    statusText += `Mode: ${modeName}\n`;
    statusText += `Icon directory: ${path.relative(projectPath, checkDir)}/\n\n`;

    if (appIcon) {
      statusText += `✓ Source icon found: ${path.basename(appIcon)}\n\n`;
    } else {
      statusText += `⚠️  No app-icon.svg or app-icon.png found in project root\n\n`;
    }

    if (existing.length > 0) {
      statusText += `✅ Existing icons (${existing.length}/${requiredIcons.length}):\n`;
      existing.forEach((icon: { name: string }) => {
        statusText += `  - ${icon.name}\n`;
      });
      statusText += '\n';
    }

    if (missing.length > 0) {
      statusText += `❌ Missing icons (${missing.length}/${requiredIcons.length}):\n`;
      missing.forEach((icon: { name: string }) => {
        statusText += `  - ${icon.name}\n`;
      });
      statusText += '\n';
    }

    if (missing.length === 0 && appIcon) {
      statusText += '🎉 All required icons are present!';
    } else if (appIcon && missing.length > 0) {
      statusText += '💡 Tip: Run auto_generate_icons to create missing icons';
    } else if (!appIcon) {
      statusText += '💡 Tip: Create app-icon.svg or app-icon.png in project root, then run auto_generate_icons';
    }

    return {
      content: [
        {
          type: 'text',
          text: statusText,
        },
      ],
    };
}

async function handleIntegrateIconsHTML(args: unknown) {
    const parsed = IntegrateIconsHTMLSchema.parse(args);
    const projectPath = path.resolve(parsed.projectPath);
    const color = parsed.color || '#5bbad5';

    // Determine HTML file to update
    let htmlFile: string;
    if (parsed.htmlPath) {
      htmlFile = path.resolve(projectPath, parsed.htmlPath);
    } else {
      // Auto-detect HTML file
      htmlFile = await findHTMLEntryPoint(projectPath);
    }

    // Check if file exists
    try {
      await fs.access(htmlFile);
    } catch {
      throw new Error(`HTML file not found: ${htmlFile}`);
    }

    // Read current HTML content
    const htmlContent = await fs.readFile(htmlFile, 'utf-8');

    // Generate icon tags (2025 standards)
    const iconTags = `<!-- Favicons (2025 standards) -->
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" href="/favicon.ico" sizes="48x48">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

<!-- Web App Manifest (PWA) -->
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#ffffff">

<!-- Safari Pinned Tab -->
<link rel="mask-icon" href="/safari-pinned-tab.svg" color="${color}">`;

    // Check if icon tags already exist
    if (htmlContent.includes('apple-touch-icon') || htmlContent.includes('site.webmanifest')) {
      return {
        content: [
          {
            type: 'text',
            text: `\u26a0\ufe0f Icon tags appear to already exist in ${path.relative(projectPath, htmlFile)}\\n\\nIf you want to update them, please remove the existing icon link tags first, then run this tool again.\\n\\n\ud83d\udcdd Icon tags to add:\\n\\n${iconTags}`,
          },
        ],
      };
    }

    // Insert icon tags into <head>
    let updatedHTML = '';
    const headMatch = htmlContent.match(/(<head[^>]*>)/i);

    if (headMatch) {
      const headEndIndex = headMatch.index! + headMatch[0].length;
      updatedHTML =
        htmlContent.slice(0, headEndIndex) +
        '\\n  ' + iconTags.split('\\n').join('\\n  ') + '\\n' +
        htmlContent.slice(headEndIndex);

      // Write updated HTML
      await fs.writeFile(htmlFile, updatedHTML);

      return {
        content: [
          {
            type: 'text',
            text: `\u2705 Successfully added icon tags to ${path.relative(projectPath, htmlFile)}\\n\\nAdded tags:\\n${iconTags.split('\\n').map(line => '  ' + line).join('\\n')}\\n\\n\ud83d\udca1 Make sure your icon files exist in the public directory. Use generate_web_icons or auto_generate_icons to create them.`,
          },
        ],
      };
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `\u26a0\ufe0f Could not find <head> tag in ${path.relative(projectPath, htmlFile)}\\n\\nPlease add these tags manually to your HTML <head>:\\n\\n${iconTags}`,
          },
        ],
      };
    }
}

// Helper function to find HTML entry point
async function findHTMLEntryPoint(projectPath: string): Promise<string> {
  // Common HTML entry point locations
  const candidates = [
    'index.html',
    'public/index.html',
    'src/index.html',
    'app/index.html',
    'src/app/layout.tsx', // Next.js App Router
    'src/routes/+layout.svelte', // SvelteKit
    'src/pages/_document.tsx', // Next.js Pages Router
    'app/root.tsx', // Remix
  ];

  for (const candidate of candidates) {
    const candidatePath = path.join(projectPath, candidate);
    try {
      await fs.access(candidatePath);
      return candidatePath;
    } catch {
      // Continue to next candidate
    }
  }

  // Default to index.html in project root
  return path.join(projectPath, 'index.html');
}

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);

console.error('Web Icons MCP server running...');
