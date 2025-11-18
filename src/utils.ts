import { promises as fs } from 'fs';
import path from 'path';
import { FRAMEWORKS, type Framework } from './types.js';

export class FrameworkDetector {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  async detect(): Promise<Framework | null> {
    for (const framework of FRAMEWORKS) {
      for (const configFile of framework.configFiles) {
        const configPath = path.join(this.cwd, configFile);
        try {
          await fs.access(configPath);
          return framework;
        } catch {
          // Config file doesn't exist, continue
        }
      }
    }
    return null;
  }

  async getPublicDir(): Promise<string> {
    const framework = await this.detect();
    if (framework) {
      return path.join(this.cwd, framework.publicDir);
    }
    // Default to 'public' directory if no framework detected
    return path.join(this.cwd, 'public');
  }

  async getAppDir(): Promise<string | null> {
    const framework = await this.detect();
    if (framework && framework.appDir) {
      // Check for app/ directory in root first
      const rootAppDir = path.join(this.cwd, framework.appDir);
      try {
        await fs.access(rootAppDir);
        return rootAppDir;
      } catch {
        // Check for app/ directory in src/ folder
        const srcAppDir = path.join(this.cwd, 'src', framework.appDir);
        try {
          await fs.access(srcAppDir);
          return srcAppDir;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  async hasAppRouter(): Promise<boolean> {
    const appDir = await this.getAppDir();
    return appDir !== null;
  }
}

export async function findAppIcon(cwd: string = process.cwd()): Promise<string | null> {
  const possibleNames = ['app-icon.svg', 'app-icon.png'];

  for (const name of possibleNames) {
    const iconPath = path.join(cwd, name);
    try {
      await fs.access(iconPath);
      return iconPath;
    } catch {
      // File doesn't exist, continue
    }
  }

  return null;
}

export async function validateSourceFile(sourcePath: string): Promise<void> {
  try {
    await fs.access(sourcePath);
  } catch {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const ext = path.extname(sourcePath).toLowerCase();
  const validExtensions = ['.svg', '.png', '.jpg', '.jpeg'];

  if (!validExtensions.includes(ext)) {
    throw new Error(`Invalid file format. Supported formats: ${validExtensions.join(', ')}`);
  }
}
