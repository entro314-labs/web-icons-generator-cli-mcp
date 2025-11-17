import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { ICON_CONFIGS, type IconConfig, type GeneratorOptions } from './types.js';

export class IconGenerator {
  private options: GeneratorOptions;

  constructor(options: GeneratorOptions) {
    this.options = options;
  }

  async generate(): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.options.outputDir, { recursive: true });

    // Check if source is SVG
    const isSourceSVG = this.options.sourcePath.toLowerCase().endsWith('.svg');

    // Generate all icon sizes
    await Promise.all(
      ICON_CONFIGS.map((config) => this.generateIcon(config))
    );

    // Handle SVG-specific files
    if (isSourceSVG) {
      await this.copySVGSource();
      await this.generateSafariPinnedTab();
    } else {
      // If source is PNG/JPG, we can't generate proper SVG
      // We'll create a note for the user
      console.warn('⚠️  Source is not SVG. icon.svg and safari-pinned-tab.svg will need to be created manually.');
    }

    // Generate site.webmanifest
    await this.generateManifest();

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
    const snippet = `<!-- Favicon (modern + fallback) -->
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<!-- Web App Manifest (PWA) -->
<link rel="manifest" href="/site.webmanifest">

<!-- Safari Pinned Tab -->
<link rel="mask-icon" href="/safari-pinned-tab.svg" color="${this.options.color || '#5bbad5'}">`;

    const outputPath = path.join(this.options.outputDir, 'html-snippet.txt');
    await fs.writeFile(outputPath, snippet);
  }
}
