export interface IconConfig {
  filename: string;
  size: number;
  format: 'png' | 'ico' | 'svg';
}

export interface GeneratorOptions {
  sourcePath: string;
  outputDir: string;
  color?: string; // For safari-pinned-tab.svg
}

export interface Framework {
  name: string;
  configFiles: string[];
  publicDir: string;
}

export const ICON_CONFIGS: IconConfig[] = [
  { filename: 'favicon.ico', size: 32, format: 'ico' },
  { filename: 'icon-192.png', size: 192, format: 'png' },
  { filename: 'icon-512.png', size: 512, format: 'png' },
  { filename: 'apple-touch-icon.png', size: 180, format: 'png' },
  { filename: 'icon-maskable.png', size: 512, format: 'png' },
];

export const FRAMEWORKS: Framework[] = [
  { name: 'Next.js', configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'], publicDir: 'public' },
  { name: 'Astro', configFiles: ['astro.config.mjs', 'astro.config.js', 'astro.config.ts'], publicDir: 'public' },
  { name: 'SvelteKit', configFiles: ['svelte.config.js'], publicDir: 'static' },
  { name: 'Remix', configFiles: ['remix.config.js'], publicDir: 'public' },
  { name: 'Vite', configFiles: ['vite.config.js', 'vite.config.ts'], publicDir: 'public' },
];
