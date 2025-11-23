export interface IconConfig {
  filename: string;
  size: number;
  format: 'png' | 'ico' | 'svg';
  mode?: 'traditional' | 'nextjs' | 'both'; // Which generation mode uses this icon
  essential?: boolean; // Include in minimal set (default: false = full set only)
}

export type GenerationMode = 'traditional' | 'nextjs' | 'auto';

export interface GeneratorOptions {
  sourcePath: string;
  outputDir: string;
  projectRoot?: string; // Project root directory for placing instructions file
  color?: string; // For safari-pinned-tab.svg
  mode?: GenerationMode; // Generation mode (traditional web app vs Next.js App Router)
  minimal?: boolean; // Generate minimal essential set only (default: false = full set)
  // PWA manifest options
  appName?: string; // Full app name for manifest
  appShortName?: string; // Short name for manifest (max 12 chars recommended)
  themeColor?: string; // Theme color for browser UI
  backgroundColor?: string; // Background color for splash screen
}

export interface Framework {
  name: string;
  configFiles: string[];
  publicDir: string;
  appDir?: string; // For Next.js App Router
}

export const ICON_CONFIGS: IconConfig[] = [
  // Traditional web app icons (used in public/)
  // Desktop favicons - individual PNGs for HTML link tags
  { filename: 'favicon-16x16.png', size: 16, format: 'png', mode: 'traditional' }, // Full only
  { filename: 'favicon-32x32.png', size: 32, format: 'png', mode: 'traditional' }, // Full only
  { filename: 'favicon-48x48.png', size: 48, format: 'png', mode: 'traditional', essential: true }, // Minimal: fallback PNG
  { filename: 'favicon-96x96.png', size: 96, format: 'png', mode: 'traditional' }, // Full only (Google)

  // PWA / Android Chrome icons
  { filename: 'android-chrome-192x192.png', size: 192, format: 'png', mode: 'traditional', essential: true }, // Minimal: PWA
  { filename: 'android-chrome-512x512.png', size: 512, format: 'png', mode: 'traditional', essential: true }, // Minimal: PWA
  { filename: 'android-chrome-maskable-512x512.png', size: 512, format: 'png', mode: 'traditional' }, // Full only

  // Apple Touch Icon
  { filename: 'apple-touch-icon.png', size: 180, format: 'png', mode: 'both', essential: true }, // Minimal: iOS

  // Next.js App Router specific icons (used in app/) - all essential for Next.js
  { filename: 'favicon.ico', size: 32, format: 'ico', mode: 'nextjs', essential: true },
  { filename: 'icon.png', size: 512, format: 'png', mode: 'nextjs', essential: true },
  { filename: 'apple-icon.png', size: 180, format: 'png', mode: 'nextjs', essential: true },
];

// Multi-resolution ICO sizes (descending order to avoid Chrome corruption)
export const ICO_SIZES = [48, 32, 16] as const;

export const FRAMEWORKS: Framework[] = [
  {
    name: 'Next.js',
    configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    publicDir: 'public',
    appDir: 'app' // Next.js App Router directory
  },
  { name: 'Astro', configFiles: ['astro.config.mjs', 'astro.config.js', 'astro.config.ts'], publicDir: 'public' },
  { name: 'SvelteKit', configFiles: ['svelte.config.js'], publicDir: 'static' },
  { name: 'Remix', configFiles: ['remix.config.js'], publicDir: 'public' },
  { name: 'Vite', configFiles: ['vite.config.js', 'vite.config.ts'], publicDir: 'public' },
];
