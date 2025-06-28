import { Plugin, ProjectAnalysis, RepositoryOptions } from '../types.js';
import { logger } from '../utils/logger.js';

export class PluginManager {
  private plugins: Plugin[] = [];

  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const pluginModule = await import(pluginPath);
      const plugin = pluginModule.default || pluginModule;
      
      if (this.isValidPlugin(plugin)) {
        this.plugins.push(plugin);
        logger.debug(`Loaded plugin: ${plugin.name}@${plugin.version}`);
      } else {
        logger.warning(`Invalid plugin format: ${pluginPath}`);
      }
    } catch (error) {
      logger.error(`Failed to load plugin ${pluginPath}: ${error.message}`);
    }
  }

  async loadPlugins(pluginPaths: string[]): Promise<void> {
    await Promise.all(pluginPaths.map(path => this.loadPlugin(path)));
  }

  private isValidPlugin(plugin: any): plugin is Plugin {
    return (
      plugin &&
      typeof plugin.name === 'string' &&
      typeof plugin.version === 'string' &&
      plugin.hooks &&
      typeof plugin.hooks === 'object'
    );
  }

  async executeHook(hookName: keyof Plugin['hooks'], ...args: any[]): Promise<any> {
    let result = args[0]; // For hooks that transform data

    for (const plugin of this.plugins) {
      const hook = plugin.hooks[hookName];
      if (hook) {
        try {
          const hookResult = await hook(...args);
          if (hookResult !== undefined) {
            result = hookResult;
          }
        } catch (error) {
          logger.error(`Plugin ${plugin.name} hook ${hookName} failed: ${error.message}`);
        }
      }
    }

    return result;
  }

  getLoadedPlugins(): Plugin[] {
    return [...this.plugins];
  }

  hasPlugins(): boolean {
    return this.plugins.length > 0;
  }
}

export const pluginManager = new PluginManager();