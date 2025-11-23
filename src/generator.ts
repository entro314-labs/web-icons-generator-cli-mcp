import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import pngToIco from 'png-to-ico';
import { ICON_CONFIGS, ICO_SIZES, type IconConfig, type GeneratorOptions } from './types.js';

export class IconGenerator {
  private options: GeneratorOptions;
  private mode: 'traditional' | 'nextjs';

  constructor(options: GeneratorOptions) {
    this.options = options;
    // Determine actual mode (resolve 'auto' to concrete mode)
    this.mode = this.resolveMode(options.mode || 'traditional');
  }

  private resolveMode(mode: GeneratorOptions['mode']): 'traditional' | 'nextjs' {
    if (mode === 'auto') {
      // Auto-detect based on output directory
      const outputDirName = path.basename(this.options.outputDir);
      return outputDirName === 'app' || this.options.outputDir.includes('/app') ? 'nextjs' : 'traditional';
    }
    return mode || 'traditional';
  }

  async generate(): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.options.outputDir, { recursive: true });

    // Check if source is SVG
    const isSourceSVG = this.options.sourcePath.toLowerCase().endsWith('.svg');

    // Filter icons based on mode and minimal flag (exclude ICO - we handle it separately)
    const isMinimal = this.options.minimal || false;
    const iconsToGenerate = ICON_CONFIGS.filter(config => {
      if (config.format === 'ico') return false; // Handle ICO separately
      // In minimal mode, only generate essential icons
      if (isMinimal && !config.essential) return false;
      if (!config.mode || config.mode === 'both') return true;
      return config.mode === this.mode;
    });

    // Generate all PNG icon sizes
    await Promise.all(
      iconsToGenerate.map((config) => this.generateIcon(config))
    );

    // Generate favicon.ico (multi-resolution for traditional, simple for nextjs)
    await this.generateFaviconIco();

    // Handle SVG files for both modes
    if (isSourceSVG) {
      await this.copySVGFavicon();
      // Safari pinned tab only for traditional mode (and only in full mode)
      if (this.mode === 'traditional' && !isMinimal) {
        await this.generateSafariPinnedTab();
      }
    } else if (!isMinimal) {
      // Only warn in full mode
      console.warn('⚠️  Source is not SVG. favicon.svg and safari-pinned-tab.svg will need to be created manually.');
    }

    // Generate site.webmanifest (only for traditional mode)
    if (this.mode === 'traditional') {
      await this.generateManifest();
    }

    // Generate HTML snippet / integration guide
    await this.generateHTMLSnippet();
  }

  private async generateIcon(config: IconConfig): Promise<void> {
    const outputPath = path.join(this.options.outputDir, config.filename);

    let sharpInstance = sharp(this.options.sourcePath).resize(config.size, config.size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

    // Handle maskable icon with padding
    if (config.filename.includes('maskable')) {
      sharpInstance = await this.addMaskablePadding(sharpInstance, config.size);
    }

    await sharpInstance.png().toFile(outputPath);
  }

  private async generateFaviconIco(): Promise<void> {
    const outputPath = path.join(this.options.outputDir, 'favicon.ico');

    if (this.mode === 'traditional') {
      // Generate multi-resolution ICO (48, 32, 16) for traditional mode
      const pngBuffers: Buffer[] = [];

      for (const size of ICO_SIZES) {
        const buffer = await sharp(this.options.sourcePath)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();
        pngBuffers.push(buffer);
      }

      // Create multi-resolution ICO
      const icoBuffer = await pngToIco(pngBuffers);
      await fs.writeFile(outputPath, icoBuffer);
    } else {
      // Simple 32x32 ICO for Next.js
      const pngBuffer = await sharp(this.options.sourcePath)
        .resize(32, 32, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      const icoBuffer = await pngToIco([pngBuffer]);
      await fs.writeFile(outputPath, icoBuffer);
    }
  }

  private async addMaskablePadding(sharpInstance: sharp.Sharp, size: number): Promise<sharp.Sharp> {
    // Maskable icons need 20% safe zone (40% total padding)
    const paddedSize = Math.floor(size * 0.6); // Icon is 60% of canvas
    const padding = Math.floor((size - paddedSize) / 2);

    return sharpInstance
      .resize(paddedSize, paddedSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
  }

  private async copySVGFavicon(): Promise<void> {
    // Use 'icon.svg' for Next.js, 'favicon.svg' for traditional
    const filename = this.mode === 'nextjs' ? 'icon.svg' : 'favicon.svg';
    const outputPath = path.join(this.options.outputDir, filename);
    await fs.copyFile(this.options.sourcePath, outputPath);
  }

  private async generateSafariPinnedTab(): Promise<void> {
    // For safari-pinned-tab.svg, we need a monochrome version
    // If source is SVG, we can copy and modify it
    const sourceSVG = await fs.readFile(this.options.sourcePath, 'utf-8');

    // Simple monochrome conversion: replace colors with black
    const monochromeColor = this.options.color || '#000000';
    const monochromeSVG = sourceSVG
      .replace(/fill="[^"]*"/g, `fill="${monochromeColor}"`)
      .replace(/stroke="[^"]*"/g, `stroke="${monochromeColor}"`);

    const outputPath = path.join(this.options.outputDir, 'safari-pinned-tab.svg');
    await fs.writeFile(outputPath, monochromeSVG);
  }

  private async generateManifest(): Promise<void> {
    const manifest = {
      name: this.options.appName || '',
      short_name: this.options.appShortName || '',
      icons: [
        {
          src: '/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/android-chrome-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
      theme_color: this.options.themeColor || '#ffffff',
      background_color: this.options.backgroundColor || '#ffffff',
      display: 'standalone',
    };

    const outputPath = path.join(this.options.outputDir, 'site.webmanifest');
    await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2));
  }

  private async generateHTMLSnippet(): Promise<void> {
    const isSourceSVG = this.options.sourcePath.toLowerCase().endsWith('.svg');
    const isMinimal = this.options.minimal || false;
    let snippet: string;

    if (this.mode === 'nextjs') {
      // Next.js App Router mode - no manual HTML needed, just instructions
      snippet = `# Next.js App Router Icon Integration Guide

## Generated Files in app/
- favicon.ico (multi-resolution: 16×16, 32×32, 48×48)
- icon.png (512×512) - main app icon
- apple-icon.png (180×180) - Apple touch icon
${isSourceSVG ? '- icon.svg - scalable vector icon' : ''}

## Auto-Generated <head> Tags
Next.js will automatically add these tags:
\`\`\`html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" href="/icon.png" type="image/png" sizes="512x512" />
<link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
${isSourceSVG ? '<link rel="icon" href="/icon.svg" type="image/svg+xml" />' : ''}
\`\`\`

## PWA Support (Optional)
For PWA support, create site.webmanifest in public/ with:
\`\`\`json
{
  "name": "Your App Name",
  "short_name": "App",
  "icons": [
    { "src": "/icon.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#ffffff",
  "background_color": "#ffffff",
  "display": "standalone"
}
\`\`\`

Then add to layout.tsx metadata:
\`\`\`typescript
export const metadata: Metadata = {
  manifest: '/site.webmanifest',
};
\`\`\``;
    } else if (isMinimal) {
      // Traditional mode - minimal essential set
      snippet = `# Web App Icon Integration Guide (Minimal)

## Generated Files
- favicon.ico (multi-resolution: 16×16, 32×32, 48×48)
- favicon-48x48.png (fallback)
- android-chrome-192x192.png, android-chrome-512x512.png (PWA)
- apple-touch-icon.png (180×180)
${isSourceSVG ? '- favicon.svg - scalable vector favicon' : ''}
- site.webmanifest - PWA manifest

## Add to <head>
\`\`\`html
<!-- Favicons (Minimal) -->
${isSourceSVG ? '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' : ''}
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
<link rel="icon" href="/favicon.ico" sizes="48x48">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

<!-- Web App Manifest (PWA) -->
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${this.options.themeColor || '#ffffff'}">
\`\`\`

Note: This is a minimal icon set. Run without --minimal for full 2025 standards compliance.`;
    } else {
      // Traditional mode - comprehensive HTML snippet (full)
      snippet = `# Web App Icon Integration Guide (Full)

## Generated Files
- favicon.ico (multi-resolution: 16×16, 32×32, 48×48)
- favicon-16x16.png, favicon-32x32.png, favicon-48x48.png
- favicon-96x96.png (Google search results)
- android-chrome-192x192.png, android-chrome-512x512.png
- android-chrome-maskable-512x512.png (PWA maskable)
- apple-touch-icon.png (180×180)
${isSourceSVG ? '- favicon.svg - scalable vector favicon\n- safari-pinned-tab.svg - Safari pinned tab' : ''}
- site.webmanifest - PWA manifest

## Add to <head>
\`\`\`html
<!-- Favicons -->
${isSourceSVG ? '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' : ''}
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" href="/favicon.ico" sizes="48x48">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

<!-- Web App Manifest (PWA) -->
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${this.options.themeColor || '#ffffff'}">

${isSourceSVG ? `<!-- Safari Pinned Tab -->\n<link rel="mask-icon" href="/safari-pinned-tab.svg" color="${this.options.color || '#5bbad5'}">` : ''}
\`\`\`

## robots.txt (Optional)
Ensure Google can access favicons:
\`\`\`
User-agent: Googlebot-Image
Allow: /favicon
Allow: /android-chrome
Allow: /apple-touch-icon
\`\`\``;
    }

    // Save to project root instead of output directory
    const outputPath = path.join(this.options.projectRoot || this.options.outputDir, 'icon-integration-guide.txt');
    await fs.writeFile(outputPath, snippet);
  }

  getMode(): 'traditional' | 'nextjs' {
    return this.mode;
  }

  getInstructionsFilePath(): string {
    return path.join(this.options.projectRoot || this.options.outputDir, 'icon-integration-guide.txt');
  }

  generateAIPrompt(framework: string | null, outputDirRelative: string): string {
    const frameworkName = framework || 'web application';
    const instructionsPath = path.relative(
      this.options.projectRoot || this.options.outputDir,
      this.getInstructionsFilePath()
    ) || 'icon-integration-guide.txt';

    if (this.mode === 'nextjs') {
      return `I generated web app icons in the ${outputDirRelative} directory for this ${frameworkName}. Please read the integration guide at ${instructionsPath} and verify that all icon files are correctly placed in the app/ directory and that Next.js will auto-link them properly. Check that the project structure follows Next.js App Router conventions.`;
    } else {
      return `I generated web app icons in the ${outputDirRelative} directory for this ${frameworkName}. Please read the integration guide at ${instructionsPath} and make sure everything is wired together correctly by adding the required HTML <link> tags to the appropriate layout/HTML files. Verify the icon paths are correct and all files are accessible.`;
    }
  }
}
