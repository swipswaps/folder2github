import { cosmiconfigSync } from 'cosmiconfig';
import { z } from 'zod';
import { ConfigSchema, type Config } from './types.js';
import { homedir } from 'os';
import { join } from 'path';

const explorer = cosmiconfigSync('f2g', {
  searchPlaces: [
    'package.json',
    '.f2grc',
    '.f2grc.json',
    '.f2grc.yaml',
    '.f2grc.yml',
    '.f2grc.js',
    '.f2grc.cjs',
    '.config/f2grc',
    '.config/f2grc.json',
  ],
});

export function loadConfig(): Config {
  const result = explorer.search();
  
  if (!result) {
    return getDefaultConfig();
  }

  try {
    return ConfigSchema.parse(result.config);
  } catch (error) {
    console.warn('Invalid configuration found, using defaults:', error);
    return getDefaultConfig();
  }
}

function getDefaultConfig(): Config {
  return {
    github: {
      username: process.env.GITHUB_USERNAME || 'swipswaps',
      token: process.env.GITHUB_TOKEN,
    },
    defaults: {
      license: 'MIT',
      private: false,
      autoVerify: true,
    },
    plugins: [],
  };
}

export function saveConfig(config: Config): void {
  const configPath = join(homedir(), '.f2grc.json');
  require('fs').writeFileSync(configPath, JSON.stringify(config, null, 2));
}