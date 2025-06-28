import { Command } from 'commander';
import { select, input, confirm, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { Listr } from 'listr2';
import { Folder2GitHub } from './folder2github.js';
import { loadConfig, saveConfig } from './config.js';
import { ProjectAnalyzer } from './analyzer.js';

const program = new Command();

program
  .name('f2g')
  .description('Next-generation automated repository creation tool')
  .version('2.0.0');

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
  .action(async (source, options) => {
    try {
      const config = loadConfig();
      const f2g = new Folder2GitHub(config);
      
      if (options.interactive) {
        await runInteractiveMode(f2g, source);
      } else {
        await runDirectMode(f2g, source, options);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze a folder and show project insights')
  .argument('<source>', 'Source folder path')
  .action(async (source) => {
    try {
      const analyzer = new ProjectAnalyzer();
      const analysis = await analyzer.analyze(source);
      
      console.log(chalk.blue('\n📊 Project Analysis Results\n'));
      console.log(chalk.green('Type:'), analysis.type);
      console.log(chalk.green('Languages:'), analysis.languages.join(', '));
      console.log(chalk.green('Features:'), analysis.features.join(', '));
      console.log(chalk.green('Files:'), analysis.metrics.fileCount);
      console.log(chalk.green('Size:'), `${(analysis.metrics.totalSize / 1024).toFixed(1)} KB`);
      console.log(chalk.green('Complexity:'), analysis.metrics.complexity);
      
      if (analysis.dependencies.package.length > 0) {
        console.log(chalk.green('Dependencies:'), analysis.dependencies.package.slice(0, 5).join(', '));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Configure f2g settings')
  .action(async () => {
    try {
      const config = loadConfig();
      
      const username = await input({
        message: 'GitHub username:',
        default: config.github.username,
      });
      
      const token = await input({
        message: 'GitHub token (optional):',
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
      
      const newConfig = {
        ...config,
        github: { username, token: token || undefined },
        defaults: { ...config.defaults, private: defaultPrivate, autoVerify },
      };
      
      saveConfig(newConfig);
      console.log(chalk.green('✅ Configuration saved!'));
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

async function runInteractiveMode(f2g: Folder2GitHub, source: string) {
  console.log(chalk.blue('\n🚀 Interactive Repository Creation\n'));
  
  // Analyze project first
  const analyzer = new ProjectAnalyzer();
  const analysis = await analyzer.analyze(source);
  
  console.log(chalk.green('📊 Project detected as:'), analysis.type);
  console.log(chalk.green('🔧 Languages:'), analysis.languages.join(', '));
  
  const name = await input({
    message: 'Repository name:',
    default: source.split('/').pop() || 'my-project',
  });
  
  const description = await input({
    message: 'Repository description:',
    default: `${analysis.type.replace('-', ' ')} project with ${analysis.languages.join(', ')}`,
  });
  
  const isPrivate = await confirm({
    message: 'Create as private repository?',
    default: false,
  });
  
  const features = await checkbox({
    message: 'Select additional features:',
    choices: [
      { name: 'GitHub Actions CI/CD', value: 'ci', checked: true },
      { name: 'Issue templates', value: 'issues' },
      { name: 'Pull request template', value: 'pr' },
      { name: 'Code of conduct', value: 'conduct' },
      { name: 'Contributing guidelines', value: 'contributing' },
    ],
  });
  
  const options = {
    name,
    description,
    private: isPrivate,
    features,
  };
  
  await executeCreation(f2g, source, options);
}

async function runDirectMode(f2g: Folder2GitHub, source: string, options: any) {
  const repoOptions = {
    name: options.name || source.split('/').pop() || 'my-project',
    description: options.description || 'Generated repository',
    private: options.private || false,
    dryRun: options.dryRun || false,
    verify: !options.noVerify,
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
      title: 'Generating documentation',
      task: () => f2g.generateDocs(options),
    },
    {
      title: 'Creating repository structure',
      task: () => f2g.createStructure(source, options),
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
    },
  });
  
  try {
    await tasks.run();
    
    if (!options.dryRun) {
      console.log(chalk.green('\n🎉 Repository created successfully!'));
      console.log(chalk.blue('🔗 URL:'), `https://github.com/${f2g.config.github.username}/${options.name}`);
    } else {
      console.log(chalk.yellow('\n📋 Dry run completed - no changes made'));
    }
  } catch (error) {
    console.error(chalk.red('\n❌ Failed to create repository:'), error.message);
    process.exit(1);
  }
}

program.parse();