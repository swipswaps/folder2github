import { glob } from 'fast-glob';
import { stat, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { ProjectAnalysis, Language, ProjectType } from './types.js';
import { logger } from './utils/logger.js';
import { cache } from './utils/cache.js';
import pLimit from 'p-limit';

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

  private readonly limit = pLimit(10); // Limit concurrent file operations

  async analyze(sourcePath: string): Promise<ProjectAnalysis> {
    logger.debug(`Starting analysis of ${sourcePath}`);
    
    // Check cache first
    const cached = await cache.getAnalysisCache(sourcePath);
    if (cached) {
      logger.debug('Using cached analysis');
      return cached;
    }

    logger.startSpinner('Analyzing project structure...');
    
    try {
      const files = await this.scanFiles(sourcePath);
      logger.updateSpinner(`Found ${files.length} files, detecting languages...`);
      
      const languages = this.detectLanguages(files);
      logger.updateSpinner('Inferring project type...');
      
      const projectType = this.inferProjectType(files, languages);
      logger.updateSpinner('Extracting features...');
      
      const features = await this.extractFeatures(sourcePath, files);
      logger.updateSpinner('Analyzing dependencies...');
      
      const dependencies = await this.analyzeDependencies(sourcePath, files);
      logger.updateSpinner('Calculating metrics...');
      
      const metrics = await this.calculateMetrics(sourcePath, files);

      const analysis: ProjectAnalysis = {
        type: projectType,
        languages,
        features,
        files: this.categorizeFiles(files),
        dependencies,
        metrics,
      };

      // Cache the result
      await cache.setAnalysisCache(sourcePath, analysis);
      
      logger.succeedSpinner(`Analysis complete: ${projectType} project with ${languages.join(', ')}`);
      return analysis;
    } catch (error) {
      logger.failSpinner('Analysis failed');
      throw error;
    }
  }

  private async scanFiles(sourcePath: string): Promise<string[]> {
    return glob('**/*', {
      cwd: sourcePath,
      ignore: [
        'node_modules/**',
        '.git/**',
        'target/**',
        '__pycache__/**',
        'dist/**',
        'build/**',
        '.next/**',
        'coverage/**',
        '*.log',
        '.DS_Store',
        'Thumbs.db'
      ],
      onlyFiles: true,
      dot: false, // Exclude hidden files by default
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

    // Enhanced pattern matching with priority
    const patterns = [
      { pattern: /memory|guardian|leak/, type: 'memory-management' as ProjectType },
      { pattern: /monitoring|metrics|api|server/, type: 'monitoring-api' as ProjectType },
      { pattern: /test|automation|ci|cd/, type: 'automation' as ProjectType },
      { pattern: /clipboard|copy|paste/, type: 'clipboard' as ProjectType },
      { pattern: /kde|plasma|desktop/, type: 'kde-tools' as ProjectType },
    ];

    for (const { pattern, type } of patterns) {
      if (pattern.test(fileContent)) {
        return type;
      }
    }
    
    if (files.some(f => f.endsWith('.service') || f.endsWith('.timer'))) {
      return 'system-management';
    }

    return 'general';
  }

  private async extractFeatures(sourcePath: string, files: string[]): Promise<string[]> {
    const features: string[] = [];
    
    // File-based feature detection
    const featureMap = [
      { pattern: /api|server|endpoint/, feature: 'REST API' },
      { pattern: /test|spec/, feature: 'Testing Framework' },
      { pattern: /docker/, feature: 'Containerization' },
      { pattern: /\.service$/, feature: 'SystemD Services' },
      { pattern: /\.yml$|\.yaml$/, feature: 'Configuration Management' },
      { pattern: /readme|doc/, feature: 'Documentation' },
    ];

    for (const { pattern, feature } of featureMap) {
      if (files.some(f => pattern.test(f.toLowerCase()))) {
        features.push(feature);
      }
    }

    // Content-based feature detection (limited for performance)
    const codeFiles = files.filter(f => 
      f.endsWith('.py') || f.endsWith('.js') || f.endsWith('.ts')
    ).slice(0, 10); // Limit to first 10 files

    const contentTasks = codeFiles.map(file => 
      this.limit(async () => {
        try {
          const content = await readFile(join(sourcePath, file), 'utf-8');
          const contentFeatures: string[] = [];
          
          if (content.includes('async def') || content.includes('asyncio') || content.includes('async ')) {
            contentFeatures.push('Async Programming');
          }
          if (content.includes('flask') || content.includes('fastapi') || content.includes('express')) {
            contentFeatures.push('Web Framework');
          }
          if (content.includes('pytest') || content.includes('jest') || content.includes('mocha')) {
            contentFeatures.push('Testing Framework');
          }
          
          return contentFeatures;
        } catch {
          return [];
        }
      })
    );

    const contentResults = await Promise.all(contentTasks);
    const contentFeatures = contentResults.flat();

    return [...new Set([...features, ...contentFeatures])];
  }

  private categorizeFiles(files: string[]): ProjectAnalysis['files'] {
    return {
      scripts: files.filter(f => 
        /\.(py|sh|rs|js|ts|go|c|cpp)$/.test(f)
      ),
      configs: files.filter(f => 
        /\.(json|yaml|yml|toml|conf|ini|env)$/.test(f) ||
        ['package.json', 'Cargo.toml', 'requirements.txt', 'go.mod'].includes(basename(f))
      ),
      docs: files.filter(f => 
        /\.(md|rst|txt|adoc)$/i.test(f)
      ),
      services: files.filter(f => 
        /\.(service|timer|socket)$/.test(f)
      ),
      tests: files.filter(f => 
        /test|spec/.test(f.toLowerCase()) || f.startsWith('test_')
      ),
    };
  }

  private async analyzeDependencies(sourcePath: string, files: string[]): Promise<ProjectAnalysis['dependencies']> {
    const packageDeps: string[] = [];
    const systemDeps: string[] = [];

    const depTasks = [
      this.analyzePackageJson(sourcePath, files, packageDeps),
      this.analyzeRequirementsTxt(sourcePath, files, packageDeps),
      this.analyzeCargoToml(sourcePath, files, packageDeps),
      this.analyzeGoMod(sourcePath, files, packageDeps),
    ];

    await Promise.all(depTasks);

    // Infer system dependencies
    if (files.some(f => f.endsWith('.service'))) {
      systemDeps.push('systemd');
    }
    if (packageDeps.some(d => d.includes('selenium'))) {
      systemDeps.push('chromium', 'chromedriver');
    }
    if (packageDeps.some(d => d.includes('postgres'))) {
      systemDeps.push('postgresql');
    }

    return {
      package: [...new Set(packageDeps)],
      system: [...new Set(systemDeps)],
    };
  }

  private async analyzePackageJson(sourcePath: string, files: string[], packageDeps: string[]): Promise<void> {
    if (!files.includes('package.json')) return;
    
    try {
      const content = await readFile(join(sourcePath, 'package.json'), 'utf-8');
      const pkg = JSON.parse(content);
      if (pkg.dependencies) {
        packageDeps.push(...Object.keys(pkg.dependencies));
      }
      if (pkg.devDependencies) {
        packageDeps.push(...Object.keys(pkg.devDependencies));
      }
    } catch {
      // Ignore parse errors
    }
  }

  private async analyzeRequirementsTxt(sourcePath: string, files: string[], packageDeps: string[]): Promise<void> {
    if (!files.includes('requirements.txt')) return;
    
    try {
      const content = await readFile(join(sourcePath, 'requirements.txt'), 'utf-8');
      const deps = content.split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => line.split(/[=<>]/)[0].trim());
      packageDeps.push(...deps);
    } catch {
      // Ignore read errors
    }
  }

  private async analyzeCargoToml(sourcePath: string, files: string[], packageDeps: string[]): Promise<void> {
    if (!files.includes('Cargo.toml')) return;
    
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

  private async analyzeGoMod(sourcePath: string, files: string[], packageDeps: string[]): Promise<void> {
    if (!files.includes('go.mod')) return;
    
    try {
      const content = await readFile(join(sourcePath, 'go.mod'), 'utf-8');
      const deps = content.match(/require\s+\(([\s\S]*?)\)/)?.[1];
      if (deps) {
        const depNames = deps.split('\n')
          .map(line => line.trim().split(' ')[0])
          .filter(dep => dep && !dep.startsWith('//'));
        packageDeps.push(...depNames);
      }
    } catch {
      // Ignore parse errors
    }
  }

  private async calculateMetrics(sourcePath: string, files: string[]): Promise<ProjectAnalysis['metrics']> {
    let totalSize = 0;
    let complexity = 0;

    const metricTasks = files.map(file => 
      this.limit(async () => {
        try {
          const stats = await stat(join(sourcePath, file));
          const size = stats.size;
          
          // Enhanced complexity calculation
          const ext = extname(file);
          let fileComplexity = 0;
          
          if (['.py', '.js', '.ts', '.rs', '.go'].includes(ext)) {
            fileComplexity = Math.ceil(size / 500); // 1 point per 500 bytes
          } else if (['.c', '.cpp', '.cc', '.cxx'].includes(ext)) {
            fileComplexity = Math.ceil(size / 300); // C/C++ is more complex
          } else {
            fileComplexity = Math.ceil(size / 1000); // Other files
          }
          
          return { size, complexity: fileComplexity };
        } catch {
          return { size: 0, complexity: 0 };
        }
      })
    );

    const results = await Promise.all(metricTasks);
    
    for (const result of results) {
      totalSize += result.size;
      complexity += result.complexity;
    }

    return {
      fileCount: files.length,
      totalSize,
      complexity,
    };
  }
}