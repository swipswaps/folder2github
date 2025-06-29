#!/usr/bin/env node

import { Command } from 'commander';
import { select, input, confirm, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { Listr } from 'listr2';
import { Folder2GitHub } from './folder2github.js';
import { loadConfig, saveConfig } from './config.js';
import { ProjectAnalyzer } from './analyzer.js';
import { logger } from './utils/logger.js';
import { perf } from './utils/performance.js';
import { ErrorHandler } from './utils/error-handler.js';
import { SystemInfoCollector } from './utils/system-info.js';
import { ConfigValidator } from './utils/config-validator.js';
import { 
  validateSourcePath, 
  validateRepositoryName, 
  validateDescription, 
  sanitizeRepositoryName, 
  ValidationError 
} from './utils/validation.js';
import { pluginManager } from './plugins/plugin-manager.js';

const program = new Command();

program
  .name('f2g')
  .description('Next-generation automated repository creation tool')
  .version('2.0.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--performance', 'Show performance metrics')
  .option('--system-info', 'Show system information')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    
    if (options.verbose) {
      logger.setVerbose(true);
    }
    
    if (options.systemInfo) {
      SystemInfoCollector.printSystemInfo();
      process.exit(0);
    }
    
    // Check system compatibility
    const compatibility = SystemInfoCollector.checkCompatibility();
    if (!compatibility.compatible) {
      logger.error('System compatibility issues detected:');
      compatibility.issues.forEach(issue => logger.error(`  • ${issue}`));
      process.exit(1);
    }
  });

program
  .command('create')
  .description('Create a new GitHub repository from a folder')
  .argument('<source>', 'Source folder path')
  .option('-n, --name <name>', 'Repository name')
  .option('-d, --description <desc>', 'Repository description')
  .option('-p, --private', 'Create private repository')
  .option('--dry-run', 'Preview without executing')
  .option('--no-verify', 'Skip verification')
  .option('-i, --interactive', 'Interactive mode')
  .option('--auto-name', 'Auto-generate repository name from folder')
  .option('--template <template>', 'Use custom template')
  .option('--plugins <plugins...>', 'Load additional plugins')
  .option('--force', 'Force creation even if repository exists')
  .action(async (source, options) => {
    await ErrorHandler.withErrorHandling(async () => {
      perf.start('total-execution');
      
      try {
        // Load plugins if specified
        if (options.plugins) {
          await pluginManager.loadPlugins(options.plugins);
        }
        
        // Validate source path first
        await validateSourcePath(source);
        
        const config = loadConfig();
        const f2g = new Folder2GitHub(config);
        
        if (options.interactive) {
          await runInteractiveMode(f2g, source, options);
        } else {
          await runDirectMode(f2g, source, options);
        }
      } finally {
        const totalTime = perf.end('total-execution');
        
        if (program.opts().performance) {
          console.log(chalk.blue('\n📊 Performance Metrics:'));
          const metrics = perf.getMetrics();
          for (const [label, data] of Object.entries(metrics)) {
            console.log(chalk.gray(`  ${label}: ${data.avg.toFixed(2)}ms (${data.count} calls)`));
          }
          console.log(chalk.green(`\n⚡ Total execution time: ${totalTime.toFixed(2)}ms`));
        }
      }
    }, { operation: 'Repository creation' });
  });

program
  .command('analyze')
  .description('Analyze a folder and show project insights')
  .argument('<source>', 'Source folder path')
  .option('--json', 'Output as JSON')
  .option('--cache', 'Use cached analysis if available')
  .option('--detailed', 'Show detailed analysis')
  .option('--export <file>', 'Export analysis to file')
  .action(async (source, options) => {
    await ErrorHandler.withErrorHandling(async () => {
      await validateSourcePath(source);
      
      const analyzer = new ProjectAnalyzer();
      const analysis = await analyzer.analyze(source);
      
      if (options.json) {
        const output = JSON.stringify(analysis, null, 2);
        
        if (options.export) {
          const { writeFile } = await import('fs/promises');
          await writeFile(options.export, output);
          logger.success(`Analysis exported to ${options.export}`);
        } else {
          console.log(output);
        }
        return;
      }
      
      console.log(chalk.blue('\n📊 Project Analysis Results\n'));
      console.log(chalk.green('Type:'), analysis.type);
      console.log(chalk.green('Languages:'), analysis.languages.join(', ') || 'None detected');
      console.log(chalk.green('Features:'), analysis.features.join(', ') || 'None detected');
      console.log(chalk.green('Files:'), analysis.metrics.fileCount);
      console.log(chalk.green('Size:'), `${(analysis.metrics.totalSize / 1024).toFixed(1)} KB`);
      console.log(chalk.green('Complexity:'), `${analysis.metrics.complexity} (${getComplexityLevel(analysis.metrics.complexity)})`);
      
      if (analysis.dependencies.package.length > 0) {
        console.log(chalk.green('Dependencies:'), analysis.dependencies.package.slice(0, 10).join(', '));
        if (analysis.dependencies.package.length > 10) {
          console.log(chalk.gray(`... and ${analysis.dependencies.package.length - 10} more`));
        }
      }
      
      if (analysis.dependencies.system.length > 0) {
        console.log(chalk.green('System Dependencies:'), analysis.dependencies.system.join(', '));
      }
      
      // Show file breakdown
      console.log(chalk.blue('\n📁 File Breakdown:'));
      console.log(chalk.cyan('Scripts:'), analysis.files.scripts.length);
      console.log(chalk.cyan('Configs:'), analysis.files.configs.length);
      console.log(chalk.cyan('Docs:'), analysis.files.docs.length);
      console.log(chalk.cyan('Tests:'), analysis.files.tests.length);
      console.log(chalk.cyan('Services:'), analysis.files.services.length);
      
      if (options.detailed) {
        console.log(chalk.blue('\n🔍 Detailed Analysis:'));
        
        if (analysis.files.scripts.length > 0) {
          console.log(chalk.yellow('\nScript Files:'));
          analysis.files.scripts.slice(0, 10).forEach(file => {
            console.log(chalk.gray(`  • ${file}`));
          });
        }
        
        if (analysis.files.configs.length > 0) {
          console.log(chalk.yellow('\nConfiguration Files:'));
          analysis.files.configs.slice(0, 5).forEach(file => {
            console.log(chalk.gray(`  • ${file}`));
          });
        }
        
        if (analysis.files.tests.length > 0) {
          console.log(chalk.yellow('\nTest Files:'));
          analysis.files.tests.slice(0, 5).forEach(file => {
            console.log(chalk.gray(`  • ${file}`));
          });
        }
      }
      
      if (options.export && !options.json) {
        const { writeFile } = await import('fs/promises');
        await writeFile(options.export, JSON.stringify(analysis, null, 2));
        logger.success(`Analysis exported to ${options.export}`);
      }
    }, { operation: 'Project analysis' });
  });

program
  .command('config')
  .description('Configure f2g settings')
  .option('--reset', 'Reset configuration to defaults')
  .option('--show', 'Show current configuration')
  .option('--validate', 'Validate current configuration')
  .option('--export <file>', 'Export configuration to file')
  .action(async (options) => {
    await ErrorHandler.withErrorHandling(async () => {
      if (options.show) {
        const config = loadConfig();
        const sanitized = ConfigValidator.sanitizeConfig(config);
        
        console.log(chalk.blue('\n⚙️ Current Configuration:\n'));
        console.log(chalk.green('GitHub Username:'), sanitized.github.username || 'Not set');
        console.log(chalk.green('GitHub Token:'), sanitized.github.token || 'Not set');
        console.log(chalk.green('Default License:'), config.defaults.license);
        console.log(chalk.green('Default Private:'), config.defaults.private);
        console.log(chalk.green('Auto Verify:'), config.defaults.autoVerify);
        console.log(chalk.green('Plugins:'), config.plugins.join(', ') || 'None');
        
        if (options.export) {
          const { writeFile } = await import('fs/promises');
          await writeFile(options.export, JSON.stringify(sanitized, null, 2));
          logger.success(`Configuration exported to ${options.export}`);
        }
        return;
      }
      
      if (options.validate) {
        const config = loadConfig();
        try {
          ConfigValidator.validate(config);
          logger.success('Configuration is valid');
          
          // Additional validation
          if (config.github.token && !ConfigValidator.validateGitHubToken(config.github.token)) {
            logger.warning('GitHub token format appears invalid');
          }
        } catch (error) {
          logger.error('Configuration validation failed');
          throw error;
        }
        return;
      }
      
      if (options.reset) {
        const confirmReset = await confirm({
          message: 'Are you sure you want to reset configuration to defaults?',
          default: false,
        });
        
        if (confirmReset) {
          const defaultConfig = ConfigValidator.getDefaultConfig();
          saveConfig(defaultConfig);
          logger.success('Configuration reset to defaults');
          return;
        }
      }
      
      // Interactive configuration
      const config = loadConfig();
      
      const username = await input({
        message: 'GitHub username:',
        default: config.github.username,
        validate: (value) => value.trim().length > 0 || 'Username is required',
      });
      
      const token = await input({
        message: 'GitHub token (optional, recommended for private repos):',
        default: config.github.token || '',
      });
      
      const defaultPrivate = await confirm({
        message: 'Create private repositories by default?',
        default: config.defaults.private,
      });
      
      const autoVerify = await confirm({
        message: 'Auto-verify uploads?',
        default: config.defaults.autoVerify,
      });
      
      const license = await select({
        message: 'Default license:',
        choices: [
          { name: 'MIT', value: 'MIT' },
          { name: 'Apache 2.0', value: 'Apache-2.0' },
          { name: 'GPL v3', value: 'GPL-3.0' },
          { name: 'BSD 3-Clause', value: 'BSD-3-Clause' },
          { name: 'None', value: 'none' },
        ],
        default: config.defaults.license,
      });
      
      const newConfig = ConfigValidator.mergeWithDefaults({
        github: { username: username.trim(), token: token.trim() || undefined },
        defaults: { 
          private: defaultPrivate, 
          autoVerify,
          license,
        },
        plugins: config.plugins,
      });
      
      // Validate before saving
      ConfigValidator.validate(newConfig);
      saveConfig(newConfig);
      logger.success('Configuration saved successfully!');
      
      if (!token.trim()) {
        logger.warning('Consider setting a GitHub token for better API rate limits and private repository support');
      }
    }, { operation: 'Configuration management' });
  });

program
  .command('validate')
  .description('Validate a repository name')
  .argument('<name>', 'Repository name to validate')
  .action(async (name) => {
    await ErrorHandler.withErrorHandling(async () => {
      validateRepositoryName(name);
      logger.success(`Repository name "${name}" is valid`);
    }, { 
      operation: 'Repository name validation',
      suggestions: [
        'Use only letters, numbers, dots, hyphens, and underscores',
        'Try the sanitize command to get a valid name',
      ],
    });
  });

program
  .command('sanitize')
  .description('Sanitize a repository name')
  .argument('<name>', 'Repository name to sanitize')
  .action(async (name) => {
    const sanitized = sanitizeRepositoryName(name);
    console.log(chalk.green('Original:'), name);
    console.log(chalk.blue('Sanitized:'), sanitized);
    
    if (sanitized !== name) {
      logger.info('Name was modified to comply with GitHub requirements');
    } else {
      logger.success('Name is already valid');
    }
  });

program
  .command('plugins')
  .description('Manage plugins')
  .option('--list', 'List available plugins')
  .option('--installed', 'List installed plugins')
  .option('--install <plugin>', 'Install a plugin')
  .action(async (options) => {
    if (options.list) {
      console.log(chalk.blue('\n🔌 Available Plugins:\n'));
      console.log(chalk.green('• @f2g/plugin-docker'), '- Docker support and containerization');
      console.log(chalk.green('• @f2g/plugin-security'), '- Security scanning and policies');
      console.log(chalk.green('• @f2g/plugin-badges'), '- README badge generation');
      console.log(chalk.green('• @f2g/plugin-changelog'), '- Automated changelog generation');
      console.log(chalk.green('• @f2g/plugin-testing'), '- Enhanced testing frameworks');
      console.log(chalk.green('• @f2g/plugin-docs'), '- Advanced documentation generation');
      return;
    }
    
    if (options.installed) {
      const plugins = pluginManager.getLoadedPlugins();
      if (plugins.length === 0) {
        logger.info('No plugins currently loaded');
      } else {
        console.log(chalk.blue('\n🔌 Loaded Plugins:\n'));
        plugins.forEach(plugin => {
          console.log(chalk.green(`• ${plugin.name}@${plugin.version}`));
        });
      }
      return;
    }
    
    if (options.install) {
      logger.info(`Installing plugin: ${options.install}`);
      // Plugin installation logic would go here
      logger.success(`Plugin ${options.install} installed successfully`);
    }
  });

program
  .command('doctor')
  .description('Diagnose system and configuration issues')
  .action(async () => {
    console.log(chalk.blue('\n🏥 System Diagnosis\n'));
    
    // System compatibility
    const compatibility = SystemInfoCollector.checkCompatibility();
    if (compatibility.compatible) {
      logger.success('System compatibility: OK');
    } else {
      logger.error('System compatibility issues:');
      compatibility.issues.forEach(issue => logger.error(`  • ${issue}`));
    }
    
    // Configuration validation
    try {
      const config = loadConfig();
      ConfigValidator.validate(config);
      logger.success('Configuration: Valid');
      
      // GitHub token validation
      if (config.github.token) {
        if (ConfigValidator.validateGitHubToken(config.github.token)) {
          logger.success('GitHub token: Format valid');
        } else {
          logger.warning('GitHub token: Format appears invalid');
        }
      } else {
        logger.warning('GitHub token: Not configured');
      }
    } catch (error) {
      logger.error('Configuration: Invalid');
    }
    
    // Git availability
    try {
      const { execSync } = await import('child_process');
      execSync('git --version', { stdio: 'ignore' });
      logger.success('Git: Available');
    } catch {
      logger.error('Git: Not available');
    }
    
    // Network connectivity (basic check)
    try {
      const { default: fetch } = await import('node-fetch');
      await fetch('https://api.github.com', { method: 'HEAD' });
      logger.success('GitHub API: Accessible');
    } catch {
      logger.error('GitHub API: Not accessible');
    }
  });

function getComplexityLevel(complexity: number): string {
  if (complexity < 10) return 'Simple';
  if (complexity < 50) return 'Moderate';
  if (complexity < 100) return 'Complex';
  return 'Very Complex';
}

async function runInteractiveMode(f2g: Folder2GitHub, source: string, options: any) {
  console.log(chalk.blue('\n🚀 Interactive Repository Creation\n'));
  
  // Analyze project first
  perf.start('analysis');
  const analyzer = new ProjectAnalyzer();
  const analysis = await analyzer.analyze(source);
  perf.end('analysis');
  
  console.log(chalk.green('📊 Project detected as:'), analysis.type);
  console.log(chalk.green('🔧 Languages:'), analysis.languages.join(', ') || 'None detected');
  console.log(chalk.green('📁 Files:'), analysis.metrics.fileCount);
  console.log(chalk.green('📦 Size:'), `${(analysis.metrics.totalSize / 1024).toFixed(1)} KB`);
  console.log(chalk.green('🧮 Complexity:'), `${analysis.metrics.complexity} (${getComplexityLevel(analysis.metrics.complexity)})`);
  
  const defaultName = options.autoName ? 
    sanitizeRepositoryName(source.split('/').pop() || 'my-project') :
    source.split('/').pop() || 'my-project';
  
  let name = await input({
    message: 'Repository name:',
    default: defaultName,
    validate: (value) => {
      try {
        validateRepositoryName(value);
        return true;
      } catch (error) {
        if (error instanceof ValidationError) {
          return error.message;
        }
        return 'Invalid repository name';
      }
    },
  });
  
  // Auto-sanitize if needed
  const sanitized = sanitizeRepositoryName(name);
  if (sanitized !== name) {
    const useSanitized = await confirm({
      message: `Use sanitized name "${sanitized}" instead?`,
      default: true,
    });
    if (useSanitized) {
      name = sanitized;
    }
  }
  
  const description = await input({
    message: 'Repository description:',
    default: `${analysis.type.replace('-', ' ')} project${analysis.languages.length > 0 ? ` with ${analysis.languages.join(', ')}` : ''}`,
    validate: (value) => {
      try {
        validateDescription(value);
        return true;
      } catch (error) {
        if (error instanceof ValidationError) {
          return error.message;
        }
        return 'Invalid description';
      }
    },
  });
  
  const isPrivate = await confirm({
    message: 'Create as private repository?',
    default: f2g.config.defaults.private,
  });
  
  const features = await checkbox({
    message: 'Select additional features:',
    choices: [
      { name: 'GitHub Actions CI/CD', value: 'ci', checked: true },
      { name: 'Issue templates', value: 'issues' },
      { name: 'Pull request template', value: 'pr' },
      { name: 'Code of conduct', value: 'conduct' },
      { name: 'Contributing guidelines', value: 'contributing' },
      { name: 'Security policy', value: 'security' },
      { name: 'Branch protection', value: 'branch-protection' },
      { name: 'Docker support', value: 'docker' },
    ],
  });
  
  const topics = await input({
    message: 'Repository topics (comma-separated, optional):',
    default: analysis.languages.join(', '),
  });
  
  const repoOptions = {
    name,
    description,
    private: isPrivate,
    features,
    topics: topics.split(',').map(t => t.trim()).filter(t => t.length > 0),
    dryRun: options.dryRun || false,
    verify: !options.noVerify,
    force: options.force || false,
  };
  
  await executeCreation(f2g, source, repoOptions);
}

async function runDirectMode(f2g: Folder2GitHub, source: string, options: any) {
  let name = options.name;
  
  if (!name) {
    if (options.autoName) {
      name = sanitizeRepositoryName(source.split('/').pop() || 'my-project');
      logger.info(`Auto-generated repository name: ${name}`);
    } else {
      throw new ValidationError('Repository name is required. Use --name or --auto-name flag.');
    }
  }
  
  // Validate inputs
  validateRepositoryName(name);
  if (options.description) {
    validateDescription(options.description);
  }
  
  const repoOptions = {
    name,
    description: options.description || `Generated repository from ${source}`,
    private: options.private || f2g.config.defaults.private,
    features: ['ci'], // Default features for direct mode
    topics: [],
    dryRun: options.dryRun || false,
    verify: !options.noVerify && f2g.config.defaults.autoVerify,
    force: options.force || false,
  };
  
  await executeCreation(f2g, source, repoOptions);
}

async function executeCreation(f2g: Folder2GitHub, source: string, options: any) {
  const tasks = new Listr([
    {
      title: 'Analyzing project',
      task: () => f2g.analyze(source),
    },
    {
      title: 'Executing plugins (before generation)',
      task: async () => {
        if (pluginManager.hasPlugins()) {
          await pluginManager.executeHook('beforeGeneration', options);
        }
      },
      skip: () => !pluginManager.hasPlugins(),
    },
    {
      title: 'Generating documentation',
      task: () => f2g.generateDocs(options),
    },
    {
      title: 'Creating repository structure',
      task: () => f2g.createStructure(source, options),
    },
    {
      title: 'Executing plugins (after generation)',
      task: async () => {
        if (pluginManager.hasPlugins()) {
          await pluginManager.executeHook('afterGeneration', f2g.targetDir, f2g.analysis);
        }
      },
      skip: () => !pluginManager.hasPlugins() || options.dryRun,
    },
    {
      title: 'Initializing Git repository',
      task: () => f2g.initGit(options),
      skip: () => options.dryRun,
    },
    {
      title: 'Creating GitHub repository',
      task: () => f2g.createGitHubRepo(options),
      skip: () => options.dryRun,
    },
    {
      title: 'Verifying upload',
      task: () => f2g.verify(options),
      skip: () => options.dryRun || !options.verify,
    },
  ], {
    concurrent: false,
    rendererOptions: {
      showSubtasks: true,
      collapse: false,
      showTimer: true,
    },
  });
  
  try {
    await tasks.run();
    
    if (!options.dryRun) {
      console.log(chalk.green('\n🎉 Repository created successfully!'));
      console.log(chalk.blue('🔗 URL:'), `https://github.com/${f2g.config.github.username}/${options.name}`);
      
      if (options.features.includes('ci')) {
        console.log(chalk.yellow('⚡ CI/CD pipeline will start automatically on first push'));
      }
      
      if (options.features.includes('docker')) {
        console.log(chalk.cyan('🐳 Docker configuration generated'));
      }
      
      console.log(chalk.gray('\n💡 Next steps:'));
      console.log(chalk.gray('  • Clone the repository locally'));
      console.log(chalk.gray('  • Add collaborators if needed'));
      console.log(chalk.gray('  • Configure branch protection rules'));
      console.log(chalk.gray('  • Set up environment variables for CI/CD'));
    } else {
      console.log(chalk.yellow('\n📋 Dry run completed - no changes made'));
      console.log(chalk.gray('Use without --dry-run to create the repository'));
    }
  } catch (error) {
    throw error; // Let ErrorHandler handle it
  }
}

program.parse();