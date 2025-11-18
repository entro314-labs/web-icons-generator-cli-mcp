import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { ICON_CONFIGS, type IconConfig, type GeneratorOptions } from './types.js';

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

    // Filter icons based on mode
    const iconsToGenerate = ICON_CONFIGS.filter(config => {
      if (!config.mode || config.mode === 'both') return true;
      return config.mode === this.mode;
    });

    // Generate all icon sizes
    await Promise.all(
      iconsToGenerate.map((config) => this.generateIcon(config))
    );

    // Handle SVG-specific files
    if (isSourceSVG) {
      await this.copySVGSource();
      // Only generate safari-pinned-tab for traditional mode (goes in public/)
      if (this.mode === 'traditional') {
        await this.generateSafariPinnedTab();
      }
    } else {
      // If source is PNG/JPG, we can't generate proper SVG
      console.warn('⚠️  Source is not SVG. icon.svg and safari-pinned-tab.svg will need to be created manually.');
    }

    // Generate site.webmanifest (only for traditional mode)
    if (this.mode === 'traditional') {
      await this.generateManifest();
    }

    // Generate HTML snippet
    await this.generateHTMLSnippet();
  }

  private async generateIcon(config: IconConfig): Promise<void> {
    const outputPath = path.join(this.options.outputDir, config.filename);

    let sharpInstance = sharp(this.options.sourcePath).resize(config.size, config.size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

    // Handle maskable icon with padding
    if (config.filename === 'icon-maskable.png') {
      sharpInstance = await this.addMaskablePadding(sharpInstance, config.size);
    }

    // Convert to appropriate format
    if (config.format === 'ico') {
      await sharpInstance.png().toFile(outputPath.replace('.ico', '.png'));
      // Note: sharp doesn't natively support .ico, so we generate PNG
      // For production, you'd use a tool like `png-to-ico`
      await fs.rename(outputPath.replace('.ico', '.png'), outputPath);
    } else {
      await sharpInstance.png().toFile(outputPath);
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

  private async copySVGSource(): Promise<void> {
    const outputPath = path.join(this.options.outputDir, 'icon.svg');
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
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/icon-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    };

    const outputPath = path.join(this.options.outputDir, 'site.webmanifest');
    await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2));
  }

  private async generateHTMLSnippet(): Promise<void> {
    let snippet: string;

    if (this.mode === 'nextjs') {
      // Next.js App Router mode - no manual HTML needed, just instructions
      snippet = `<!-- Next.js App Router Mode -->
<!-- Icons are automatically linked by Next.js from the /app directory -->
<!-- No manual <link> tags needed! -->

Generated files in app/:
- favicon.ico (32×32) - automatically linked as /favicon.ico
- icon.png (512×512) - automatically linked with proper metadata
- apple-icon.png (180×180) - automatically linked as apple-touch-icon
${this.options.sourcePath.toLowerCase().endsWith('.svg') ? '- icon.svg - automatically linked with type="image/svg+xml"' : ''}

Next.js will automatically generate these <head> tags:
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" href="/icon.png" type="image/png" sizes="512x512" />
<link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
${this.options.sourcePath.toLowerCase().endsWith('.svg') ? '<link rel="icon" href="/icon.svg" type="image/svg+xml" />' : ''}

For PWA support, add site.webmanifest to public/ and reference it in your layout.tsx metadata.`;
    } else {
      // Traditional mode - full HTML snippet
      snippet = `<!-- Favicon (modern + fallback) -->
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<!-- Web App Manifest (PWA) -->
<link rel="manifest" href="/site.webmanifest">

<!-- Safari Pinned Tab -->
<link rel="mask-icon" href="/safari-pinned-tab.svg" color="${this.options.color || '#5bbad5'}">`;
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
