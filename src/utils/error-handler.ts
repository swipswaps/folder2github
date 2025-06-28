import { logger } from './logger.js';
import { ValidationError, GitHubError, AnalysisError, F2GError } from '../types.js';

export interface ErrorContext {
  operation: string;
  details?: any;
  suggestions?: string[];
}

export class ErrorHandler {
  static handle(error: Error, context?: ErrorContext): never {
    const errorInfo = this.analyzeError(error);
    
    // Log the error with context
    logger.error(`${context?.operation || 'Operation'} failed: ${errorInfo.message}`);
    
    if (context?.details) {
      logger.debug(`Error details: ${JSON.stringify(context.details, null, 2)}`);
    }
    
    // Provide helpful suggestions
    if (errorInfo.suggestions.length > 0) {
      logger.info('💡 Suggestions:');
      errorInfo.suggestions.forEach(suggestion => {
        logger.info(`  • ${suggestion}`);
      });
    }
    
    // Exit with appropriate code
    process.exit(errorInfo.exitCode);
  }

  private static analyzeError(error: Error): {
    message: string;
    suggestions: string[];
    exitCode: number;
  } {
    if (error instanceof ValidationError) {
      return {
        message: error.message,
        suggestions: this.getValidationSuggestions(error),
        exitCode: 1,
      };
    }
    
    if (error instanceof GitHubError) {
      return {
        message: error.message,
        suggestions: this.getGitHubSuggestions(error),
        exitCode: 2,
      };
    }
    
    if (error instanceof AnalysisError) {
      return {
        message: error.message,
        suggestions: this.getAnalysisSuggestions(error),
        exitCode: 3,
      };
    }
    
    // Generic error handling
    return {
      message: error.message,
      suggestions: this.getGenericSuggestions(error),
      exitCode: 1,
    };
  }

  private static getValidationSuggestions(error: ValidationError): string[] {
    const suggestions: string[] = [];
    
    if (error.field === 'repositoryName') {
      suggestions.push('Use only letters, numbers, dots, hyphens, and underscores');
      suggestions.push('Try the --auto-name flag to generate a valid name');
      suggestions.push('Use the validate command to check name validity');
    }
    
    if (error.field === 'sourcePath') {
      suggestions.push('Ensure the path exists and is readable');
      suggestions.push('Check file permissions');
      suggestions.push('Use an absolute path if relative path fails');
    }
    
    if (error.field === 'description') {
      suggestions.push('Keep description under 350 characters');
      suggestions.push('Provide a meaningful description of your project');
    }
    
    return suggestions;
  }

  private static getGitHubSuggestions(error: GitHubError): string[] {
    const suggestions: string[] = [];
    
    if (error.statusCode === 401) {
      suggestions.push('Check your GitHub token configuration');
      suggestions.push('Run: f2g config to set up authentication');
      suggestions.push('Ensure token has repository creation permissions');
    }
    
    if (error.statusCode === 403) {
      suggestions.push('GitHub API rate limit exceeded');
      suggestions.push('Wait a few minutes and try again');
      suggestions.push('Use a GitHub token for higher rate limits');
    }
    
    if (error.statusCode === 422) {
      suggestions.push('Repository name might already exist');
      suggestions.push('Try a different repository name');
      suggestions.push('Check your GitHub account for existing repositories');
    }
    
    return suggestions;
  }

  private static getAnalysisSuggestions(error: AnalysisError): string[] {
    return [
      'Ensure the source directory contains valid project files',
      'Check file permissions in the source directory',
      'Try with a different source directory',
    ];
  }

  private static getGenericSuggestions(error: Error): string[] {
    const suggestions: string[] = [];
    
    if (error.message.includes('ENOENT')) {
      suggestions.push('File or directory not found');
      suggestions.push('Check the path and try again');
    }
    
    if (error.message.includes('EACCES')) {
      suggestions.push('Permission denied');
      suggestions.push('Check file permissions');
      suggestions.push('Try running with appropriate permissions');
    }
    
    if (error.message.includes('network') || error.message.includes('timeout')) {
      suggestions.push('Network connectivity issue');
      suggestions.push('Check your internet connection');
      suggestions.push('Try again in a few minutes');
    }
    
    return suggestions;
  }

  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handle(error as Error, context);
    }
  }
}