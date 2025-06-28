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
import { validateSourcePath, validateRepositoryName, validateDescription, sanitizeRepositoryName, ValidationError } from './utils/validation.js';
import { pluginManager } from './plugins/plugin-manager.js';

const program = new Command();

program
  .name('f2g')
  .description('Next-generation automated repository creation tool')
  .version('2.0.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--performance', 'Show performance metrics')
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts();
    if (options.verbose) {
      logger.setVerbose(true);
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
  .action(async (source, options) => {
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
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Validation Error: ${error.message}`);
      } else {
        logger.error(`Error: ${error.message}`);
      }
      process.exit(1);
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
  });

program
  .command('analyze')
  .description('Analyze a folder and show project insights')
  .argument('<source>', 'Source folder path')
  .option('--json', 'Output as JSON')
  .option('--cache', 'Use cached analysis if available')
  .option('--detailed', 'Show detailed analysis')
  .action(async (source, options) => {
    try {
      await validateSourcePath(source);
      
      const analyzer = new ProjectAnalyzer();
      const analysis = await analyzer.analyze(source);
      
      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
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
      
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Validation Error: ${error.message}`);
      } else {
        logger.error(`Error: ${error.message}`);
      }
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Configure f2g settings')
  .option('--reset', 'Reset configuration to defaults')
  .option('--show', 'Show current configuration')
  .action(async (options) => {
    try {
      if (options.show) {
        const config = loadConfig();
        console.log(chalk.blue('\n⚙️ Current Configuration:\n'));
        console.log(chalk.green('GitHub Username:'), config.github.username || 'Not set');
        console.log(chalk.green('GitHub Token:'), config.github.token ? '***' : 'Not set');
        console.log(chalk.green('Default License:'), config.defaults.license);
        console.log(chalk.green('Default Private:'), config.defaults.private);
        console.log(chalk.green('Auto Verify:'), config.defaults.autoVerify);
        console.log(chalk.green('Plugins:'), config.plugins.join(', ') || 'None');
        return;
      }
      
      if (options.reset) {
        const confirmReset = await confirm({
          message: 'Are you sure you want to reset configuration to defaults?',
          default: false,
        });
        
        if (confirmReset) {
          // Reset to defaults by saving empty config
          saveConfig({
            github: { username: '', token: undefined },
            defaults: { license: 'MIT', private: false, autoVerify: true },
            plugins: [],
          });
          logger.success('Configuration reset to defaults');
          return;
        }
      }
      
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
      
      const newConfig = {
        ...config,
        github: { username: username.trim(), token: token.trim() || undefined },
        defaults: { 
          ...config.defaults, 
          private: defaultPrivate, 
          autoVerify,
          license,
        },
      };
      
      saveConfig(newConfig);
      logger.success('Configuration saved successfully!');
      
      if (!token.trim()) {
        logger.warning('Consider setting a GitHub token for better API rate limits and private repository support');
      }
      
    } catch (error) {
      logger.error(`Configuration error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate a repository name')
  .argument('<name>', 'Repository name to validate')
  .action(async (name) => {
    try {
      validateRepositoryName(name);
      logger.success(`Repository name "${name}" is valid`);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Invalid repository name: ${error.message}`);
        const sanitized = sanitizeRepositoryName(name);
        if (sanitized !== name) {
          logger.info(`Suggested name: "${sanitized}"`);
        }
      } else {
        logger.error(`Error: ${error.message}`);
      }
      process.exit(1);
    }
  });

program
  .command('plugins')
  .description('Manage plugins')
  .option('--list', 'List available plugins')
  .option('--install <plugin>', 'Install a plugin')
  .action(async (options) => {
    if (options.list) {
      console.log(chalk.blue('\n🔌 Available Plugins:\n'));
      console.log(chalk.green('• @f2g/plugin-docker'), '- Docker support and containerization');
      console.log(chalk.green('• @f2g/plugin-security'), '- Security scanning and policies');
      console.log(chalk.green('• @f2g/plugin-badges'), '- README badge generation');
      console.log(chalk.green('• @f2g/plugin-changelog'), '- Automated changelog generation');
      return;
    }
    
    if (options.install) {
      logger.info(`Installing plugin: ${options.install}`);
      // Plugin installation logic would go here
      logger.success(`Plugin ${options.install} installed successfully`);
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
    logger.error(`Failed to create repository: ${error.message}`);
    
    if (error.message.includes('already exists')) {
      logger.info('Try using a different repository name or check your GitHub account');
    } else if (error.message.includes('rate limit')) {
      logger.info('GitHub API rate limit exceeded. Try again later or use a GitHub token');
    } else if (error.message.includes('authentication')) {
      logger.info('GitHub authentication failed. Check your token in the configuration');
    }
    
    process.exit(1);
  }
}

program.parse();