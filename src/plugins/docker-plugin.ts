import { Plugin, ProjectAnalysis } from '../types.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const dockerPlugin: Plugin = {
  name: '@f2g/plugin-docker',
  version: '1.0.0',
  hooks: {
    afterAnalysis: async (analysis: ProjectAnalysis): Promise<ProjectAnalysis> => {
      // Check if project has Docker-related files
      const hasDockerfile = analysis.files.configs.some(f => f.toLowerCase().includes('dockerfile'));
      const hasDockerCompose = analysis.files.configs.some(f => f.toLowerCase().includes('docker-compose'));
      
      if (hasDockerfile || hasDockerCompose) {
        analysis.features.push('Docker Support');
      }
      
      return analysis;
    },

    afterGeneration: async (targetPath: string, analysis: ProjectAnalysis): Promise<void> => {
      // Generate Dockerfile if not present
      const hasDockerfile = analysis.files.configs.some(f => f.toLowerCase().includes('dockerfile'));
      
      if (!hasDockerfile && shouldGenerateDockerfile(analysis)) {
        await generateDockerfile(targetPath, analysis);
      }
      
      // Generate docker-compose.yml for web applications
      if (analysis.features.includes('Web Framework')) {
        await generateDockerCompose(targetPath, analysis);
      }
    },
  },
};

function shouldGenerateDockerfile(analysis: ProjectAnalysis): boolean {
  return (
    analysis.languages.includes('python') ||
    analysis.languages.includes('typescript') ||
    analysis.languages.includes('javascript') ||
    analysis.features.includes('Web Framework')
  );
}

async function generateDockerfile(targetPath: string, analysis: ProjectAnalysis): Promise<void> {
  let dockerfile = '';

  if (analysis.languages.includes('python')) {
    dockerfile = `# Python Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app \\
    && chown -R app:app /app
USER app

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["python", "app.py"]
`;
  } else if (analysis.languages.includes('typescript') || analysis.languages.includes('javascript')) {
    dockerfile = `# Node.js Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

# Run application
CMD ["npm", "start"]
`;
  }

  if (dockerfile) {
    await writeFile(join(targetPath, 'Dockerfile'), dockerfile);
  }
}

async function generateDockerCompose(targetPath: string, analysis: ProjectAnalysis): Promise<void> {
  const compose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  ${analysis.dependencies.system.includes('postgresql') ? `
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: app
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
` : ''}
`;

  await writeFile(join(targetPath, 'docker-compose.yml'), compose);
}