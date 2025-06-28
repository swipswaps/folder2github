import { execa } from 'execa';
import { mkdir, writeFile, copyFile, readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import pLimit from 'p-limit';
import { Octokit } from '@octokit/rest';
import { ProjectAnalyzer } from './analyzer.js';
import { ReadmeGenerator } from './generators/readme.js';
import { CIGenerator } from './generators/ci.js';
import { ModernVerifier } from './verifier.js';
import { Config, ProjectAnalysis, RepositoryOptions } from './types.js';

export class Folder2GitHub {
  private analyzer = new ProjectAnalyzer();
  private readmeGenerator = new ReadmeGenerator();
  private ciGenerator = new CIGenerator();
  private verifier = new ModernVerifier();
  private octokit: Octokit;
  private analysis?: ProjectAnalysis;
  private targetDir?: string;

  constructor(public config: Config) {
    this.octokit = new Octokit({
      auth: config.github.token,
    });
  }

  async analyze(sourcePath: string): Promise<ProjectAnalysis> {
    this.analysis = await this.analyzer.analyze(sourcePath);
    return this.analysis;
  }

  async generateDocs(options: RepositoryOptions): Promise<void> {
    if (!this.analysis) {
      throw new Error('Project must be analyzed first');
    }

    // Generate README.md
    const readmeContent = this.readmeGenerator.generate(this.analysis, options);
    await writeFile(join(this.targetDir!, 'README.md'), readmeContent);

    // Generate CI workflow
    const ciContent = this.ciGenerator.generate(this.analysis, options);
    await mkdir(join(this.targetDir!, '.github', 'workflows'), { recursive: true });
    await writeFile(join(this.targetDir!, '.github', 'workflows', 'ci.yml'), ciContent);

    // Generate LICENSE
    const licenseContent = this.generateLicense();
    await writeFile(join(this.targetDir!, 'LICENSE'), licenseContent);

    // Generate .gitignore
    const gitignoreContent = this.generateGitignore();
    await writeFile(join(this.targetDir!, '.gitignore'), gitignoreContent);
  }

  async createStructure(sourcePath: string, options: RepositoryOptions): Promise<void> {
    this.targetDir = join(process.cwd(), 'temp', options.name);
    await mkdir(this.targetDir, { recursive: true });

    // Copy files with parallel processing
    const limit = pLimit(10);
    await this.copyFiles(sourcePath, this.targetDir, limit);
  }

  async initGit(options: RepositoryOptions): Promise<void> {
    if (!this.targetDir) throw new Error('Target directory not set');

    await execa('git', ['init'], { cwd: this.targetDir });
    await execa('git', ['branch', '-m', 'main'], { cwd: this.targetDir });
    await execa('git', ['config', 'user.name', this.config.github.username], { cwd: this.targetDir });
    await execa('git', ['config', 'user.email', `${this.config.github.username}@users.noreply.github.com`], { cwd: this.targetDir });
    await execa('git', ['add', '.'], { cwd: this.targetDir });
    await execa('git', ['commit', '-m', `Initial commit: ${options.description}`], { cwd: this.targetDir });
  }

  async createGitHubRepo(options: RepositoryOptions): Promise<void> {
    if (!this.targetDir) throw new Error('Target directory not set');

    // Create repository
    await this.octokit.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.private,
      auto_init: false,
      allow_squash_merge: options.allowSquashMerge,
      allow_merge_commit: options.allowMergeCommit,
      allow_rebase_merge: options.allowRebaseMerge,
      delete_branch_on_merge: options.deleteBranchOnMerge,
    });

    // Add topics if specified
    if (options.topics.length > 0) {
      await this.octokit.repos.replaceAllTopics({
        owner: this.config.github.username,
        repo: options.name,
        names: options.topics,
      });
    }

    // Push to GitHub
    const repoUrl = `https://github.com/${this.config.github.username}/${options.name}.git`;
    await execa('git', ['remote', 'add', 'origin', repoUrl], { cwd: this.targetDir });
    await execa('git', ['push', '-u', 'origin', 'main'], { cwd: this.targetDir });
  }

  async verify(options: RepositoryOptions): Promise<void> {
    const repositoryUrl = `https://github.com/${this.config.github.username}/${options.name}`;
    const result = await this.verifier.verify(repositoryUrl);
    
    if (result.overallStatus !== 'SUCCESS') {
      throw new Error(`Verification failed: ${result.overallStatus}`);
    }
  }

  private async copyFiles(sourcePath: string, targetPath: string, limit: any): Promise<void> {
    const entries = await readdir(sourcePath, { withFileTypes: true });
    
    const copyTasks = entries.map(entry => 
      limit(async () => {
        const sourceFull = join(sourcePath, entry.name);
        const targetFull = join(targetPath, entry.name);
        
        if (entry.isDirectory()) {
          await mkdir(targetFull, { recursive: true });
          await this.copyFiles(sourceFull, targetFull, limit);
        } else {
          await copyFile(sourceFull, targetFull);
        }
      })
    );
    
    await Promise.all(copyTasks);
  }

  private generateLicense(): string {
    return `MIT License

Copyright (c) ${new Date().getFullYear()} ${this.config.github.username}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
  }

  private generateGitignore(): string {
    const patterns = [
      '# Dependencies',
      'node_modules/',
      '__pycache__/',
      'target/',
      'dist/',
      'build/',
      '',
      '# Environment',
      '.env',
      '.env.local',
      '',
      '# IDE',
      '.vscode/',
      '.idea/',
      '*.swp',
      '*.swo',
      '',
      '# OS',
      '.DS_Store',
      'Thumbs.db',
      '',
      '# Logs',
      '*.log',
      'logs/',
      '',
      '# Temporary',
      'temp/',
      'tmp/',
      '*.tmp',
    ];

    if (this.analysis?.languages.includes('python')) {
      patterns.push('', '# Python', '*.pyc', '.pytest_cache/', 'venv/', '.coverage');
    }

    if (this.analysis?.languages.includes('rust')) {
      patterns.push('', '# Rust', 'Cargo.lock', 'target/');
    }

    if (this.analysis?.languages.includes('typescript') || this.analysis?.languages.includes('javascript')) {
      patterns.push('', '# Node.js', 'package-lock.json', 'yarn.lock', 'coverage/');
    }

    return patterns.join('\n');
  }
}