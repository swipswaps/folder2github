import { readdir, stat, copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import pLimit from 'p-limit';
import { logger } from './logger.js';
import { ProgressTracker } from './progress.js';

export interface CopyOptions {
  concurrency?: number;
  skipPatterns?: string[];
  onProgress?: (current: number, total: number, file: string) => void;
}

export class FileOperations {
  private limit: any;
  private progress = new ProgressTracker();

  constructor(concurrency: number = 10) {
    this.limit = pLimit(concurrency);
  }

  async copyDirectory(
    sourcePath: string, 
    targetPath: string, 
    options: CopyOptions = {}
  ): Promise<void> {
    const { skipPatterns = [], onProgress } = options;
    
    logger.debug(`Starting directory copy: ${sourcePath} → ${targetPath}`);
    
    // Scan all files first
    const allFiles = await this.scanAllFiles(sourcePath, skipPatterns);
    this.progress.setTotal(allFiles.length);
    
    if (onProgress) {
      this.progress.on('progress', (event) => {
        onProgress(event.current, event.total, event.message || '');
      });
    }

    // Copy files in parallel
    const copyTasks = allFiles.map(relativePath => 
      this.limit(async () => {
        const sourceFull = join(sourcePath, relativePath);
        const targetFull = join(targetPath, relativePath);
        
        try {
          // Ensure target directory exists
          await mkdir(dirname(targetFull), { recursive: true });
          
          // Copy file
          await copyFile(sourceFull, targetFull);
          
          this.progress.increment(`Copied ${basename(relativePath)}`);
          logger.debug(`Copied: ${relativePath}`);
        } catch (error) {
          logger.warning(`Failed to copy ${relativePath}: ${error.message}`);
        }
      })
    );

    await Promise.all(copyTasks);
    logger.success(`Copied ${allFiles.length} files successfully`);
  }

  private async scanAllFiles(
    sourcePath: string, 
    skipPatterns: string[]
  ): Promise<string[]> {
    const files: string[] = [];
    
    const scanRecursive = async (currentPath: string, relativePath: string = '') => {
      const entries = await readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryRelativePath = join(relativePath, entry.name);
        
        if (this.shouldSkipFile(entry.name, skipPatterns)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await scanRecursive(join(currentPath, entry.name), entryRelativePath);
        } else {
          files.push(entryRelativePath);
        }
      }
    };
    
    await scanRecursive(sourcePath);
    return files;
  }

  private shouldSkipFile(name: string, customSkipPatterns: string[] = []): boolean {
    const defaultSkipPatterns = [
      '.git',
      'node_modules',
      '__pycache__',
      'target',
      'dist',
      'build',
      '.next',
      'coverage',
      '.DS_Store',
      'Thumbs.db',
      '*.log',
      '.env',
      '.env.local',
      '.vscode',
      '.idea',
    ];

    const allPatterns = [...defaultSkipPatterns, ...customSkipPatterns];
    
    return allPatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(name);
      }
      return name === pattern;
    });
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true });
  }

  async writeFileWithDir(filePath: string, content: string): Promise<void> {
    await this.ensureDirectory(dirname(filePath));
    await writeFile(filePath, content, 'utf-8');
  }

  async readFileIfExists(filePath: string): Promise<string | null> {
    try {
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  async getFileStats(filePath: string) {
    try {
      return await stat(filePath);
    } catch {
      return null;
    }
  }

  async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    const calculateRecursive = async (currentPath: string) => {
      const entries = await readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          await calculateRecursive(entryPath);
        } else {
          const stats = await stat(entryPath);
          totalSize += stats.size;
        }
      }
    };
    
    await calculateRecursive(dirPath);
    return totalSize;
  }
}

export const fileOps = new FileOperations();