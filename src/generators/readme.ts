import { ProjectAnalysis, RepositoryOptions } from '../types.js';

export class ReadmeGenerator {
  generate(analysis: ProjectAnalysis, options: RepositoryOptions): string {
    const config = this.getTypeConfig(analysis.type);
    
    return `# ${config.emoji} ${this.formatTitle(options.name)}

${config.emoji} **${options.description}**

## ✨ Features

${this.generateFeatures(analysis)}

## 📁 Project Structure

\`\`\`
${this.generateStructure(analysis)}
\`\`\`

## 🚀 Quick Start

${this.generateQuickStart(analysis)}

## 📈 Usage Examples

${this.generateUsageExamples(analysis)}

## ⚙️ Configuration

${this.generateConfiguration(analysis)}

## 🧪 Testing

${this.generateTesting(analysis)}

## 📊 Metrics

${this.generateMetrics(analysis)}

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (\`git checkout -b feature/enhancement\`)
3. Commit your changes (\`git commit -m 'Add enhancement'\`)
4. Push to the branch (\`git push origin feature/enhancement\`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ using modern development practices**
`;
  }

  private getTypeConfig(type: string) {
    const configs = {
      'memory-management': { emoji: '🧠', title: 'Memory Management' },
      'monitoring-api': { emoji: '📊', title: 'Monitoring API' },
      'automation': { emoji: '🧪', title: 'Automation Framework' },
      'clipboard': { emoji: '📋', title: 'Clipboard Management' },
      'kde-tools': { emoji: '🖥️', title: 'KDE Tools' },
      'system-management': { emoji: '🛠️', title: 'System Management' },
      'general': { emoji: '⚙️', title: 'Development Tools' },
    };
    
    return configs[type] || configs.general;
  }

  private formatTitle(name: string): string {
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private generateFeatures(analysis: ProjectAnalysis): string {
    const features = analysis.features.map(f => `- **${f}**: Advanced ${f.toLowerCase()} capabilities`);
    
    if (analysis.languages.includes('python')) {
      features.push('- **Python Integration**: Modern Python 3 with type hints and async support');
    }
    
    if (analysis.languages.includes('rust')) {
      features.push('- **Rust Performance**: Memory-safe, high-performance implementation');
    }
    
    if (analysis.languages.includes('typescript')) {
      features.push('- **TypeScript**: Type-safe development with modern tooling');
    }

    return features.join('\n');
  }

  private generateStructure(analysis: ProjectAnalysis): string {
    const structure = [`${this.formatTitle('project')}/`];
    
    if (analysis.files.scripts.length > 0) {
      structure.push('├── src/');
      analysis.files.scripts.slice(0, 3).forEach(script => {
        structure.push(`│   ├── ${script.split('/').pop()}`);
      });
    }
    
    if (analysis.files.configs.length > 0) {
      structure.push('├── config/');
    }
    
    if (analysis.files.tests.length > 0) {
      structure.push('├── tests/');
    }
    
    structure.push('├── docs/');
    structure.push('└── README.md');
    
    return structure.join('\n');
  }

  private generateQuickStart(analysis: ProjectAnalysis): string {
    const sections = ['### Prerequisites\n```bash'];
    
    if (analysis.languages.includes('python')) {
      sections.push('# Python 3.8+\npython3 --version');
    }
    
    if (analysis.languages.includes('rust')) {
      sections.push('# Rust toolchain\ncurl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh');
    }
    
    if (analysis.dependencies.system.length > 0) {
      sections.push(`# System dependencies\nsudo apt install ${analysis.dependencies.system.join(' ')}`);
    }
    
    sections.push('```\n\n### Installation\n```bash');
    sections.push('git clone <repository-url>\ncd <repository-name>');
    
    if (analysis.dependencies.package.length > 0) {
      if (analysis.languages.includes('python')) {
        sections.push('pip install -r requirements.txt');
      }
      if (analysis.languages.includes('rust')) {
        sections.push('cargo build --release');
      }
    }
    
    sections.push('```');
    
    return sections.join('\n');
  }

  private generateUsageExamples(analysis: ProjectAnalysis): string {
    const examples = [];
    
    if (analysis.features.includes('REST API')) {
      examples.push('### API Usage\n```bash\n# Start the server\npython3 app.py\n\n# Test endpoints\ncurl http://localhost:8080/api/health\n```');
    }
    
    if (analysis.features.includes('Testing Framework')) {
      examples.push('### Running Tests\n```bash\n# Run all tests\npytest\n\n# Run with coverage\npytest --cov\n```');
    }
    
    return examples.join('\n\n') || '### Basic Usage\n```bash\n# Run the main script\n./main.sh\n```';
  }

  private generateConfiguration(analysis: ProjectAnalysis): string {
    if (analysis.files.configs.length > 0) {
      return `Configuration files are located in the \`config/\` directory:\n\n${analysis.files.configs.map(c => `- \`${c}\``).join('\n')}`;
    }
    
    return 'Configuration options can be set via environment variables or command-line arguments.';
  }

  private generateTesting(analysis: ProjectAnalysis): string {
    if (analysis.files.tests.length > 0) {
      return `### Test Suite\n\`\`\`bash\n# Run tests\nnpm test  # or pytest, cargo test\n\n# Run with coverage\nnpm run test:coverage\n\`\`\`\n\nTest files: ${analysis.files.tests.length} files`;
    }
    
    return '```bash\n# Basic validation\n./validate.sh\n```';
  }

  private generateMetrics(analysis: ProjectAnalysis): string {
    return `- **Files**: ${analysis.metrics.fileCount}
- **Languages**: ${analysis.languages.join(', ')}
- **Size**: ${(analysis.metrics.totalSize / 1024).toFixed(1)} KB
- **Complexity**: ${analysis.metrics.complexity} points`;
  }
}