import { glob } from 'fast-glob';
import { stat, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { ProjectAnalysis, Language, ProjectType } from './types.js';

export class ProjectAnalyzer {
  private readonly languageMap: Record<string, Language> = {
    '.py': 'python',
    '.rs': 'rust',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.ts': 'typescript',
    '.js': 'javascript',
    '.go': 'go',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
  };

  async analyze(sourcePath: string): Promise<ProjectAnalysis> {
    const files = await this.scanFiles(sourcePath);
    const languages = this.detectLanguages(files);
    const projectType = this.inferProjectType(files, languages);
    const features = await this.extractFeatures(sourcePath, files);
    const dependencies = await this.analyzeDependencies(sourcePath, files);
    const metrics = await this.calculateMetrics(sourcePath, files);

    return {
      type: projectType,
      languages,
      features,
      files: this.categorizeFiles(files),
      dependencies,
      metrics,
    };
  }

  private async scanFiles(sourcePath: string): Promise<string[]> {
    return glob('**/*', {
      cwd: sourcePath,
      ignore: ['node_modules/**', '.git/**', 'target/**', '__pycache__/**'],
      onlyFiles: true,
    });
  }

  private detectLanguages(files: string[]): Language[] {
    const languageSet = new Set<Language>();
    
    for (const file of files) {
      const ext = extname(file);
      const language = this.languageMap[ext];
      if (language) {
        languageSet.add(language);
      }
    }

    return Array.from(languageSet);
  }

  private inferProjectType(files: string[], languages: Language[]): ProjectType {
    const fileNames = files.map(f => basename(f).toLowerCase());
    const fileContent = files.join(' ').toLowerCase();

    // Pattern matching for project types
    if (fileContent.includes('memory') || fileContent.includes('guardian')) {
      return 'memory-management';
    }
    
    if (fileContent.includes('monitoring') || fileContent.includes('api')) {
      return 'monitoring-api';
    }
    
    if (fileContent.includes('automation') || fileContent.includes('test')) {
      return 'automation';
    }
    
    if (fileContent.includes('clipboard')) {
      return 'clipboard';
    }
    
    if (fileContent.includes('kde') || fileContent.includes('plasma')) {
      return 'kde-tools';
    }
    
    if (files.some(f => f.endsWith('.service') || f.endsWith('.timer'))) {
      return 'system-management';
    }

    return 'general';
  }

  private async extractFeatures(sourcePath: string, files: string[]): Promise<string[]> {
    const features: string[] = [];
    
    // Analyze file patterns and content
    if (files.some(f => f.includes('api'))) {
      features.push('REST API');
    }
    
    if (files.some(f => f.includes('test'))) {
      features.push('Testing Framework');
    }
    
    if (files.some(f => f.endsWith('.service'))) {
      features.push('SystemD Services');
    }
    
    if (files.some(f => f.includes('docker'))) {
      features.push('Containerization');
    }

    // Check for specific patterns in Python files
    const pythonFiles = files.filter(f => f.endsWith('.py'));
    for (const file of pythonFiles.slice(0, 5)) { // Limit to avoid performance issues
      try {
        const content = await readFile(join(sourcePath, file), 'utf-8');
        if (content.includes('async def') || content.includes('asyncio')) {
          features.push('Async Programming');
        }
        if (content.includes('flask') || content.includes('fastapi')) {
          features.push('Web Framework');
        }
      } catch {
        // Ignore read errors
      }
    }

    return [...new Set(features)];
  }

  private categorizeFiles(files: string[]): ProjectAnalysis['files'] {
    return {
      scripts: files.filter(f => 
        f.endsWith('.py') || f.endsWith('.sh') || f.endsWith('.rs') || f.endsWith('.js') || f.endsWith('.ts')
      ),
      configs: files.filter(f => 
        f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml') || 
        f.endsWith('.toml') || f.endsWith('.conf') || f.endsWith('.ini')
      ),
      docs: files.filter(f => 
        f.endsWith('.md') || f.endsWith('.rst') || f.endsWith('.txt') || f.endsWith('.adoc')
      ),
      services: files.filter(f => 
        f.endsWith('.service') || f.endsWith('.timer') || f.endsWith('.socket')
      ),
      tests: files.filter(f => 
        f.includes('test') || f.includes('spec') || f.startsWith('test_')
      ),
    };
  }

  private async analyzeDependencies(sourcePath: string, files: string[]): Promise<ProjectAnalysis['dependencies']> {
    const packageDeps: string[] = [];
    const systemDeps: string[] = [];

    // Check package.json
    if (files.includes('package.json')) {
      try {
        const content = await readFile(join(sourcePath, 'package.json'), 'utf-8');
        const pkg = JSON.parse(content);
        if (pkg.dependencies) {
          packageDeps.push(...Object.keys(pkg.dependencies));
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check requirements.txt
    if (files.includes('requirements.txt')) {
      try {
        const content = await readFile(join(sourcePath, 'requirements.txt'), 'utf-8');
        const deps = content.split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => line.split('==')[0].split('>=')[0].split('<=')[0].trim());
        packageDeps.push(...deps);
      } catch {
        // Ignore read errors
      }
    }

    // Check Cargo.toml
    if (files.includes('Cargo.toml')) {
      try {
        const content = await readFile(join(sourcePath, 'Cargo.toml'), 'utf-8');
        const deps = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/)?.[1];
        if (deps) {
          const depNames = deps.match(/^(\w+)\s*=/gm)?.map(m => m.split('=')[0].trim()) || [];
          packageDeps.push(...depNames);
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Infer system dependencies
    if (files.some(f => f.endsWith('.service'))) {
      systemDeps.push('systemd');
    }
    if (packageDeps.some(d => d.includes('selenium'))) {
      systemDeps.push('chromium', 'chromedriver');
    }

    return {
      package: [...new Set(packageDeps)],
      system: [...new Set(systemDeps)],
    };
  }

  private async calculateMetrics(sourcePath: string, files: string[]): Promise<ProjectAnalysis['metrics']> {
    let totalSize = 0;
    let complexity = 0;

    for (const file of files) {
      try {
        const stats = await stat(join(sourcePath, file));
        totalSize += stats.size;
        
        // Simple complexity calculation based on file type and size
        const ext = extname(file);
        if (['.py', '.js', '.ts', '.rs'].includes(ext)) {
          complexity += Math.ceil(stats.size / 1000); // 1 point per KB of code
        }
      } catch {
        // Ignore stat errors
      }
    }

    return {
      fileCount: files.length,
      totalSize,
      complexity,
    };
  }
}