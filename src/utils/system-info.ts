import { platform, arch, release, cpus, totalmem, freemem } from 'os';
import { execSync } from 'child_process';
import { logger } from './logger.js';

export interface SystemInfo {
  platform: string;
  architecture: string;
  release: string;
  nodeVersion: string;
  npmVersion: string;
  gitVersion: string;
  memory: {
    total: number;
    free: number;
    used: number;
  };
  cpu: {
    model: string;
    cores: number;
  };
  environment: {
    ci: boolean;
    githubActions: boolean;
    docker: boolean;
  };
}

export class SystemInfoCollector {
  static collect(): SystemInfo {
    const cpuInfo = cpus()[0];
    const totalMem = totalmem();
    const freeMem = freemem();

    return {
      platform: platform(),
      architecture: arch(),
      release: release(),
      nodeVersion: process.version,
      npmVersion: this.getCommandVersion('npm --version'),
      gitVersion: this.getCommandVersion('git --version'),
      memory: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
      },
      cpu: {
        model: cpuInfo?.model || 'Unknown',
        cores: cpus().length,
      },
      environment: {
        ci: this.isCI(),
        githubActions: this.isGitHubActions(),
        docker: this.isDocker(),
      },
    };
  }

  private static getCommandVersion(command: string): string {
    try {
      return execSync(command, { encoding: 'utf-8' }).trim();
    } catch {
      return 'Not available';
    }
  }

  private static isCI(): boolean {
    return !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.BUILD_NUMBER ||
      process.env.JENKINS_URL
    );
  }

  private static isGitHubActions(): boolean {
    return !!process.env.GITHUB_ACTIONS;
  }

  private static isDocker(): boolean {
    try {
      execSync('which docker', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  static formatMemory(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  static printSystemInfo(): void {
    const info = this.collect();
    
    logger.info('System Information:');
    logger.info(`  Platform: ${info.platform} ${info.architecture}`);
    logger.info(`  Node.js: ${info.nodeVersion}`);
    logger.info(`  Git: ${info.gitVersion}`);
    logger.info(`  Memory: ${this.formatMemory(info.memory.used)}/${this.formatMemory(info.memory.total)}`);
    logger.info(`  CPU: ${info.cpu.model} (${info.cpu.cores} cores)`);
    
    if (info.environment.ci) {
      logger.info('  Environment: CI/CD detected');
    }
    
    if (info.environment.githubActions) {
      logger.info('  Environment: GitHub Actions');
    }
  }

  static checkCompatibility(): { compatible: boolean; issues: string[] } {
    const info = this.collect();
    const issues: string[] = [];

    // Check Node.js version
    const nodeVersion = parseInt(info.nodeVersion.slice(1)); // Remove 'v' prefix
    if (nodeVersion < 18) {
      issues.push(`Node.js ${nodeVersion} is not supported. Please upgrade to Node.js 18 or higher.`);
    }

    // Check Git availability
    if (info.gitVersion === 'Not available') {
      issues.push('Git is not installed or not available in PATH.');
    }

    // Check memory
    const memoryGB = info.memory.total / (1024 ** 3);
    if (memoryGB < 1) {
      issues.push('Low memory detected. At least 1GB RAM is recommended.');
    }

    return {
      compatible: issues.length === 0,
      issues,
    };
  }
}