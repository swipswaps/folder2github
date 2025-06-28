import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

export class Cache {
  private cacheDir: string;

  constructor() {
    this.cacheDir = join(homedir(), '.f2g', 'cache');
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await mkdir(this.cacheDir, { recursive: true });
    } catch {
      // Directory already exists or creation failed
    }
  }

  private getCacheKey(data: any): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  async get<T>(key: string, maxAge: number = 3600000): Promise<T | null> {
    try {
      await this.ensureCacheDir();
      const cacheFile = join(this.cacheDir, `${key}.json`);
      
      const stats = await stat(cacheFile);
      const age = Date.now() - stats.mtime.getTime();
      
      if (age > maxAge) {
        return null;
      }

      const content = await readFile(cacheFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async set<T>(key: string, data: T): Promise<void> {
    try {
      await this.ensureCacheDir();
      const cacheFile = join(this.cacheDir, `${key}.json`);
      await writeFile(cacheFile, JSON.stringify(data, null, 2));
    } catch {
      // Ignore cache write errors
    }
  }

  async getAnalysisCache(sourcePath: string): Promise<any | null> {
    const stats = await stat(sourcePath).catch(() => null);
    if (!stats) return null;

    const cacheKey = this.getCacheKey({
      path: sourcePath,
      mtime: stats.mtime.getTime(),
      size: stats.size,
    });

    return this.get(`analysis_${cacheKey}`);
  }

  async setAnalysisCache(sourcePath: string, analysis: any): Promise<void> {
    const stats = await stat(sourcePath).catch(() => null);
    if (!stats) return;

    const cacheKey = this.getCacheKey({
      path: sourcePath,
      mtime: stats.mtime.getTime(),
      size: stats.size,
    });

    await this.set(`analysis_${cacheKey}`, analysis);
  }
}

export const cache = new Cache();