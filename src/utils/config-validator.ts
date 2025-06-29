import { z } from 'zod';
import { Config } from '../types.js';
import { logger } from './logger.js';

export class ConfigValidator {
  private static readonly schema = z.object({
    github: z.object({
      username: z.string().min(1, 'GitHub username is required'),
      token: z.string().optional(),
    }),
    defaults: z.object({
      license: z.enum(['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'none']),
      private: z.boolean(),
      autoVerify: z.boolean(),
    }),
    templates: z.object({
      readme: z.string().optional(),
      license: z.string().optional(),
      gitignore: z.string().optional(),
    }).optional(),
    plugins: z.array(z.string()),
  });

  static validate(config: unknown): Config {
    try {
      return this.schema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Configuration validation failed:');
        error.errors.forEach(err => {
          logger.error(`  • ${err.path.join('.')}: ${err.message}`);
        });
        throw new Error('Invalid configuration');
      }
      throw error;
    }
  }

  static validatePartial(config: unknown): Partial<Config> {
    try {
      return this.schema.partial().parse(config);
    } catch (error) {
      logger.warning('Some configuration values are invalid and will be ignored');
      return {};
    }
  }

  static getDefaultConfig(): Config {
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

  static mergeWithDefaults(userConfig: Partial<Config>): Config {
    const defaultConfig = this.getDefaultConfig();
    
    return {
      github: {
        ...defaultConfig.github,
        ...userConfig.github,
      },
      defaults: {
        ...defaultConfig.defaults,
        ...userConfig.defaults,
      },
      templates: userConfig.templates,
      plugins: userConfig.plugins || defaultConfig.plugins,
    };
  }

  static validateGitHubToken(token?: string): boolean {
    if (!token) return false;
    
    // GitHub tokens should start with 'ghp_' (personal access tokens)
    // or 'github_pat_' (fine-grained personal access tokens)
    return token.startsWith('ghp_') || token.startsWith('github_pat_');
  }

  static sanitizeConfig(config: Config): Config {
    return {
      ...config,
      github: {
        ...config.github,
        token: config.github.token ? '***' : undefined,
      },
    };
  }
}