export interface IconConfig {
  filename: string;
  size: number;
  format: 'png' | 'ico' | 'svg';
  mode?: 'traditional' | 'nextjs' | 'both'; // Which generation mode uses this icon
}

export type GenerationMode = 'traditional' | 'nextjs' | 'auto';

export interface GeneratorOptions {
  sourcePath: string;
  outputDir: string;
  color?: string; // For safari-pinned-tab.svg
  mode?: GenerationMode; // Generation mode (traditional web app vs Next.js App Router)
}

export interface Framework {
  name: string;
  configFiles: string[];
  publicDir: string;
  appDir?: string; // For Next.js App Router
}

export const ICON_CONFIGS: IconConfig[] = [
  // Traditional web app icons (used in public/)
  { filename: 'favicon.ico', size: 32, format: 'ico', mode: 'both' },
  { filename: 'icon-192.png', size: 192, format: 'png', mode: 'traditional' },
  { filename: 'icon-512.png', size: 512, format: 'png', mode: 'traditional' },
  { filename: 'apple-touch-icon.png', size: 180, format: 'png', mode: 'both' }, // Keep for compatibility
  { filename: 'icon-maskable.png', size: 512, format: 'png', mode: 'traditional' },

  // Next.js App Router specific icons (used in app/)
  { filename: 'icon.png', size: 512, format: 'png', mode: 'nextjs' }, // Next.js auto-detects this
  { filename: 'apple-icon.png', size: 180, format: 'png', mode: 'nextjs' }, // Next.js naming convention
];

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
