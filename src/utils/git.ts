import { execa } from 'execa';
import { logger } from './logger.js';

export interface GitConfig {
  name: string;
  email: string;
  defaultBranch: string;
}

export class GitManager {
  constructor(private workingDir: string, private config: GitConfig) {}

  async init(): Promise<void> {
    logger.debug('Initializing Git repository');
    
    try {
      await execa('git', ['init'], { cwd: this.workingDir });
      await execa('git', ['branch', '-m', this.config.defaultBranch], { cwd: this.workingDir });
      await this.setConfig();
    } catch (error) {
      throw new Error(`Git initialization failed: ${error.message}`);
    }
  }

  async setConfig(): Promise<void> {
    await execa('git', ['config', 'user.name', this.config.name], { cwd: this.workingDir });
    await execa('git', ['config', 'user.email', this.config.email], { cwd: this.workingDir });
    await execa('git', ['config', 'init.defaultBranch', this.config.defaultBranch], { cwd: this.workingDir });
  }

  async addAll(): Promise<void> {
    await execa('git', ['add', '.'], { cwd: this.workingDir });
  }

  async commit(message: string, description?: string): Promise<void> {
    const fullMessage = description ? `${message}\n\n${description}` : message;
    await execa('git', ['commit', '-m', fullMessage], { cwd: this.workingDir });
  }

  async addRemote(name: string, url: string): Promise<void> {
    await execa('git', ['remote', 'add', name, url], { cwd: this.workingDir });
  }

  async push(remote: string = 'origin', branch?: string): Promise<void> {
    const pushBranch = branch || this.config.defaultBranch;
    await execa('git', ['push', '-u', remote, pushBranch], { cwd: this.workingDir });
  }

  async getStatus(): Promise<string> {
    const { stdout } = await execa('git', ['status', '--porcelain'], { cwd: this.workingDir });
    return stdout;
  }

  async getBranch(): Promise<string> {
    const { stdout } = await execa('git', ['branch', '--show-current'], { cwd: this.workingDir });
    return stdout.trim();
  }

  async getCommitCount(): Promise<number> {
    try {
      const { stdout } = await execa('git', ['rev-list', '--count', 'HEAD'], { cwd: this.workingDir });
      return parseInt(stdout.trim(), 10);
    } catch {
      return 0;
    }
  }

  async createTag(tag: string, message?: string): Promise<void> {
    const args = ['tag'];
    if (message) {
      args.push('-a', tag, '-m', message);
    } else {
      args.push(tag);
    }
    await execa('git', args, { cwd: this.workingDir });
  }

  async pushTags(): Promise<void> {
    await execa('git', ['push', '--tags'], { cwd: this.workingDir });
  }
}