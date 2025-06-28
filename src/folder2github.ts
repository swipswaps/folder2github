import { execa } from 'execa';
import { mkdir, writeFile, copyFile, readdir, stat, rm } from 'fs/promises';
import { join, basename } from 'path';
import pLimit from 'p-limit';
import { Octokit } from '@octokit/rest';
import { ProjectAnalyzer } from './analyzer.js';
import { ReadmeGenerator } from './generators/readme.js';
import { CIGenerator } from './generators/ci.js';
import { ModernVerifier } from './verifier.js';
import { Config, ProjectAnalysis, RepositoryOptions } from './types.js';
import { logger } from './utils/logger.js';
import { tmpdir } from 'os';

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
      userAgent: 'folder2github-enhanced/2.0.0',
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

    logger.debug('Generating documentation files');

    // Generate README.md
    const readmeContent = this.readmeGenerator.generate(this.analysis, options);
    await writeFile(join(this.targetDir!, 'README.md'), readmeContent);

    // Generate CI workflow if requested
    if (options.features?.includes('ci')) {
      const ciContent = this.ciGenerator.generate(this.analysis, options);
      await mkdir(join(this.targetDir!, '.github', 'workflows'), { recursive: true });
      await writeFile(join(this.targetDir!, '.github', 'workflows', 'ci.yml'), ciContent);
    }

    // Generate LICENSE
    if (this.config.defaults.license !== 'none') {
      const licenseContent = this.generateLicense();
      await writeFile(join(this.targetDir!, 'LICENSE'), licenseContent);
    }

    // Generate .gitignore
    const gitignoreContent = this.generateGitignore();
    await writeFile(join(this.targetDir!, '.gitignore'), gitignoreContent);

    // Generate additional templates if requested
    if (options.features?.includes('issues')) {
      await this.generateIssueTemplates();
    }

    if (options.features?.includes('pr')) {
      await this.generatePRTemplate();
    }

    if (options.features?.includes('conduct')) {
      await this.generateCodeOfConduct();
    }

    if (options.features?.includes('contributing')) {
      await this.generateContributing();
    }

    if (options.features?.includes('security')) {
      await this.generateSecurityPolicy();
    }
  }

  async createStructure(sourcePath: string, options: RepositoryOptions): Promise<void> {
    // Create temporary directory with unique name
    const tempId = Date.now().toString(36);
    this.targetDir = join(tmpdir(), `f2g-${tempId}-${options.name}`);
    
    logger.debug(`Creating target directory: ${this.targetDir}`);
    await mkdir(this.targetDir, { recursive: true });

    // Copy files with parallel processing and progress tracking
    const limit = pLimit(10);
    await this.copyFiles(sourcePath, this.targetDir, limit);
  }

  async initGit(options: RepositoryOptions): Promise<void> {
    if (!this.targetDir) throw new Error('Target directory not set');

    logger.debug('Initializing Git repository');

    try {
      await execa('git', ['init'], { cwd: this.targetDir });
      await execa('git', ['branch', '-m', 'main'], { cwd: this.targetDir });
      await execa('git', ['config', 'user.name', this.config.github.username], { cwd: this.targetDir });
      await execa('git', ['config', 'user.email', `${this.config.github.username}@users.noreply.github.com`], { cwd: this.targetDir });
      
      // Add all files
      await execa('git', ['add', '.'], { cwd: this.targetDir });
      
      // Create initial commit
      const commitMessage = `Initial commit: ${options.description}

Generated with folder2github-enhanced
- Project type: ${this.analysis?.type || 'unknown'}
- Languages: ${this.analysis?.languages.join(', ') || 'none'}
- Files: ${this.analysis?.metrics.fileCount || 0}`;

      await execa('git', ['commit', '-m', commitMessage], { cwd: this.targetDir });
    } catch (error) {
      throw new Error(`Git initialization failed: ${error.message}`);
    }
  }

  async createGitHubRepo(options: RepositoryOptions): Promise<void> {
    if (!this.targetDir) throw new Error('Target directory not set');

    logger.debug(`Creating GitHub repository: ${options.name}`);

    try {
      // Check if repository already exists
      try {
        await this.octokit.repos.get({
          owner: this.config.github.username,
          repo: options.name,
        });
        throw new Error(`Repository '${options.name}' already exists`);
      } catch (error) {
        if (error.status !== 404) {
          throw error;
        }
        // Repository doesn't exist, which is what we want
      }

      // Create repository
      const repoData = await this.octokit.repos.createForAuthenticatedUser({
        name: options.name,
        description: options.description,
        private: options.private,
        auto_init: false,
        allow_squash_merge: options.allowSquashMerge ?? true,
        allow_merge_commit: options.allowMergeCommit ?? true,
        allow_rebase_merge: options.allowRebaseMerge ?? true,
        delete_branch_on_merge: options.deleteBranchOnMerge ?? true,
        has_issues: true,
        has_projects: false,
        has_wiki: false,
      });

      // Add topics if specified
      if (options.topics && options.topics.length > 0) {
        await this.octokit.repos.replaceAllTopics({
          owner: this.config.github.username,
          repo: options.name,
          names: options.topics.slice(0, 20), // GitHub limits to 20 topics
        });
      }

      // Push to GitHub
      const repoUrl = this.config.github.token 
        ? `https://${this.config.github.token}@github.com/${this.config.github.username}/${options.name}.git`
        : `https://github.com/${this.config.github.username}/${options.name}.git`;
      
      await execa('git', ['remote', 'add', 'origin', repoUrl], { cwd: this.targetDir });
      await execa('git', ['push', '-u', 'origin', 'main'], { cwd: this.targetDir });

      logger.debug('Repository created and pushed successfully');
    } catch (error) {
      if (error.status === 401) {
        throw new Error('GitHub authentication failed. Check your token configuration.');
      } else if (error.status === 403) {
        throw new Error('GitHub API rate limit exceeded or insufficient permissions.');
      } else if (error.message.includes('already exists')) {
        throw error;
      } else {
        throw new Error(`GitHub repository creation failed: ${error.message}`);
      }
    } finally {
      // Clean up temporary directory
      if (this.targetDir) {
        try {
          await rm(this.targetDir, { recursive: true, force: true });
          logger.debug('Cleaned up temporary directory');
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  async verify(options: RepositoryOptions): Promise<void> {
    const repositoryUrl = `https://github.com/${this.config.github.username}/${options.name}`;
    logger.debug(`Verifying repository: ${repositoryUrl}`);
    
    const result = await this.verifier.verify(repositoryUrl);
    
    if (result.overallStatus === 'FAILED') {
      throw new Error(`Verification failed: ${JSON.stringify(result.tests, null, 2)}`);
    } else if (result.overallStatus === 'PARTIAL') {
      logger.warning('Verification completed with warnings');
      logger.debug(JSON.stringify(result.tests, null, 2));
    } else {
      logger.debug('Verification completed successfully');
    }
  }

  private async copyFiles(sourcePath: string, targetPath: string, limit: any): Promise<void> {
    const entries = await readdir(sourcePath, { withFileTypes: true });
    
    const copyTasks = entries
      .filter(entry => !this.shouldSkipFile(entry.name))
      .map(entry => 
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

  private shouldSkipFile(name: string): boolean {
    const skipPatterns = [
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
    ];

    return skipPatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(name);
      }
      return name === pattern;
    });
  }

  private generateLicense(): string {
    const year = new Date().getFullYear();
    const author = this.config.github.username;

    switch (this.config.defaults.license) {
      case 'Apache-2.0':
        return `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright ${year} ${author}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`;

      case 'GPL-3.0':
        return `GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) ${year} ${author}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.`;

      case 'BSD-3-Clause':
        return `BSD 3-Clause License

Copyright (c) ${year}, ${author}

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;

      default: // MIT
        return `MIT License

Copyright (c) ${year} ${author}

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
      '.env.*.local',
      '',
      '# IDE',
      '.vscode/',
      '.idea/',
      '*.swp',
      '*.swo',
      '*~',
      '',
      '# OS',
      '.DS_Store',
      '.DS_Store?',
      'Thumbs.db',
      'ehthumbs.db',
      '',
      '# Logs',
      '*.log',
      'logs/',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      '',
      '# Runtime',
      'pids',
      '*.pid',
      '*.seed',
      '*.pid.lock',
      '',
      '# Coverage',
      'coverage/',
      '.nyc_output',
      '',
      '# Temporary',
      'temp/',
      'tmp/',
      '*.tmp',
      '*.temp',
    ];

    if (this.analysis?.languages.includes('python')) {
      patterns.push('', '# Python', '*.pyc', '*.pyo', '*.pyd', '.pytest_cache/', 'venv/', 'env/', '.coverage', '.tox/', '*.egg-info/');
    }

    if (this.analysis?.languages.includes('rust')) {
      patterns.push('', '# Rust', 'Cargo.lock', 'target/', '**/*.rs.bk');
    }

    if (this.analysis?.languages.includes('typescript') || this.analysis?.languages.includes('javascript')) {
      patterns.push('', '# Node.js', 'package-lock.json', 'yarn.lock', 'coverage/', '.next/', '.nuxt/', '.cache/');
    }

    if (this.analysis?.languages.includes('go')) {
      patterns.push('', '# Go', '*.exe', '*.exe~', '*.dll', '*.so', '*.dylib', 'vendor/');
    }

    return patterns.join('\n');
  }

  private async generateIssueTemplates(): Promise<void> {
    const templatesDir = join(this.targetDir!, '.github', 'ISSUE_TEMPLATE');
    await mkdir(templatesDir, { recursive: true });

    const bugReport = `---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''

---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. Ubuntu 20.04]
 - Version [e.g. 1.0.0]

**Additional context**
Add any other context about the problem here.
`;

    const featureRequest = `---
name: Feature request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''

---

**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
`;

    await writeFile(join(templatesDir, 'bug_report.md'), bugReport);
    await writeFile(join(templatesDir, 'feature_request.md'), featureRequest);
  }

  private async generatePRTemplate(): Promise<void> {
    const template = `## Description
Brief description of the changes in this PR.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Checklist
- [ ] Code follows the project's style guidelines
- [ ] Self-review of code completed
- [ ] Code is commented, particularly in hard-to-understand areas
- [ ] Documentation updated if needed
- [ ] No new warnings introduced

## Related Issues
Fixes #(issue number)
`;

    await writeFile(join(this.targetDir!, '.github', 'pull_request_template.md'), template);
  }

  private async generateCodeOfConduct(): Promise<void> {
    const conduct = `# Code of Conduct

## Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone.

## Our Standards

Examples of behavior that contributes to creating a positive environment include:

* Using welcoming and inclusive language
* Being respectful of differing viewpoints and experiences
* Gracefully accepting constructive criticism
* Focusing on what is best for the community

## Enforcement

Project maintainers are responsible for clarifying the standards of acceptable behavior and are expected to take appropriate and fair corrective action in response to any instances of unacceptable behavior.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant](https://www.contributor-covenant.org), version 2.0.
`;

    await writeFile(join(this.targetDir!, 'CODE_OF_CONDUCT.md'), conduct);
  }

  private async generateContributing(): Promise<void> {
    const contributing = `# Contributing

Thank you for your interest in contributing to this project!

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your feature or bug fix
4. Make your changes
5. Test your changes
6. Commit your changes with a clear message
7. Push to your fork
8. Create a Pull Request

## Development Setup

\`\`\`bash
# Clone the repository
git clone <your-fork-url>
cd <repository-name>

# Install dependencies
${this.analysis?.languages.includes('python') ? 'pip install -r requirements.txt' : ''}
${this.analysis?.languages.includes('typescript') || this.analysis?.languages.includes('javascript') ? 'npm install' : ''}
${this.analysis?.languages.includes('rust') ? 'cargo build' : ''}
\`\`\`

## Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Write tests for new functionality

## Submitting Changes

1. Ensure all tests pass
2. Update documentation if needed
3. Create a clear pull request description
4. Reference any related issues

## Questions?

Feel free to open an issue for any questions or concerns.
`;

    await writeFile(join(this.targetDir!, 'CONTRIBUTING.md'), contributing);
  }

  private async generateSecurityPolicy(): Promise<void> {
    const security = `# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please send an email to the project maintainer.

**Please do not report security vulnerabilities through public GitHub issues.**

Include the following information:
- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

We will respond to your report within 48 hours and provide regular updates on our progress.
`;

    await writeFile(join(this.targetDir!, 'SECURITY.md'), security);
  }
}