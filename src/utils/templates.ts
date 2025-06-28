import { ProjectAnalysis, RepositoryOptions } from '../types.js';

export interface TemplateContext {
  analysis: ProjectAnalysis;
  options: RepositoryOptions;
  config: any;
  helpers: TemplateHelpers;
}

export interface TemplateHelpers {
  formatTitle: (text: string) => string;
  formatLanguages: (languages: string[]) => string;
  formatSize: (bytes: number) => string;
  formatComplexity: (complexity: number) => string;
  generateBadges: (analysis: ProjectAnalysis) => string;
  generateTOC: (sections: string[]) => string;
}

export class TemplateEngine {
  private helpers: TemplateHelpers = {
    formatTitle: (text: string) => 
      text.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    
    formatLanguages: (languages: string[]) => 
      languages.map(lang => `\`${lang}\``).join(', '),
    
    formatSize: (bytes: number) => {
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      
      return `${size.toFixed(1)} ${units[unitIndex]}`;
    },
    
    formatComplexity: (complexity: number) => {
      if (complexity < 10) return 'Simple';
      if (complexity < 50) return 'Moderate';
      if (complexity < 100) return 'Complex';
      return 'Very Complex';
    },
    
    generateBadges: (analysis: ProjectAnalysis) => {
      const badges: string[] = [];
      
      // Language badges
      analysis.languages.forEach(lang => {
        const color = this.getLanguageColor(lang);
        badges.push(`![${lang}](https://img.shields.io/badge/${lang}-${color}?style=flat-square&logo=${lang.toLowerCase()})`);
      });
      
      // License badge
      badges.push(`![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)`);
      
      // Build status badge
      badges.push(`![CI](https://github.com/username/repo/workflows/CI/badge.svg?style=flat-square)`);
      
      return badges.join(' ');
    },
    
    generateTOC: (sections: string[]) => {
      return sections.map(section => {
        const anchor = section.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return `- [${section}](#${anchor})`;
      }).join('\n');
    },
  };

  private getLanguageColor(language: string): string {
    const colors: Record<string, string> = {
      python: '3776ab',
      typescript: '3178c6',
      javascript: 'f7df1e',
      rust: 'dea584',
      go: '00add8',
      shell: '89e051',
      c: '555555',
      cpp: '00599c',
    };
    return colors[language] || '666666';
  }

  render(template: string, context: TemplateContext): string {
    let result = template;
    
    // Replace variables
    result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path);
      return value !== undefined ? String(value) : match;
    });
    
    // Replace helper functions
    result = result.replace(/\{\{(\w+)\s+([^}]+)\}\}/g, (match, helperName, args) => {
      const helper = this.helpers[helperName as keyof TemplateHelpers];
      if (typeof helper === 'function') {
        try {
          const argValue = this.getNestedValue(context, args.trim());
          return helper(argValue);
        } catch {
          return match;
        }
      }
      return match;
    });
    
    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  createContext(analysis: ProjectAnalysis, options: RepositoryOptions, config: any): TemplateContext {
    return {
      analysis,
      options,
      config,
      helpers: this.helpers,
    };
  }
}

export const templateEngine = new TemplateEngine();