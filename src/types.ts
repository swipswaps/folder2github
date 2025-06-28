import { z } from 'zod';

export const ProjectTypeSchema = z.enum([
  'memory-management',
  'monitoring-api',
  'automation',
  'clipboard',
  'kde-tools',
  'system-management',
  'general'
]);

export const LanguageSchema = z.enum([
  'python',
  'rust',
  'shell',
  'typescript',
  'javascript',
  'go',
  'c',
  'cpp'
]);

export const ConfigSchema = z.object({
  github: z.object({
    username: z.string(),
    token: z.string().optional(),
  }),
  defaults: z.object({
    license: z.string().default('MIT'),
    private: z.boolean().default(false),
    autoVerify: z.boolean().default(true),
  }),
  templates: z.object({
    readme: z.string().optional(),
    license: z.string().optional(),
    gitignore: z.string().optional(),
  }).optional(),
  plugins: z.array(z.string()).default([]),
});

export const ProjectAnalysisSchema = z.object({
  type: ProjectTypeSchema,
  languages: z.array(LanguageSchema),
  features: z.array(z.string()),
  files: z.object({
    scripts: z.array(z.string()),
    configs: z.array(z.string()),
    docs: z.array(z.string()),
    services: z.array(z.string()),
    tests: z.array(z.string()),
  }),
  dependencies: z.object({
    package: z.array(z.string()),
    system: z.array(z.string()),
  }),
  metrics: z.object({
    fileCount: z.number(),
    totalSize: z.number(),
    complexity: z.number(),
  }),
});

export const RepositoryOptionsSchema = z.object({
  name: z.string(),
  description: z.string(),
  private: z.boolean().default(false),
  autoInit: z.boolean().default(true),
  gitignoreTemplate: z.string().optional(),
  licenseTemplate: z.string().optional(),
  allowSquashMerge: z.boolean().default(true),
  allowMergeCommit: z.boolean().default(true),
  allowRebaseMerge: z.boolean().default(true),
  deleteBranchOnMerge: z.boolean().default(true),
  topics: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  dryRun: z.boolean().default(false),
  verify: z.boolean().default(true),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ProjectAnalysis = z.infer<typeof ProjectAnalysisSchema>;
export type RepositoryOptions = z.infer<typeof RepositoryOptionsSchema>;
export type ProjectType = z.infer<typeof ProjectTypeSchema>;
export type Language = z.infer<typeof LanguageSchema>;

export interface VerificationResult {
  timestamp: string;
  repositoryUrl: string;
  tests: Record<string, {
    status: 'PASS' | 'FAIL' | 'WARN';
    message?: string;
    data?: any;
  }>;
  overallStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  screenshot?: string;
  performance: {
    loadTime: number;
    responseTime: number;
  };
}

export interface Plugin {
  name: string;
  version: string;
  hooks: {
    beforeAnalysis?: (sourcePath: string) => Promise<void>;
    afterAnalysis?: (analysis: ProjectAnalysis) => Promise<ProjectAnalysis>;
    beforeGeneration?: (options: RepositoryOptions) => Promise<void>;
    afterGeneration?: (targetPath: string) => Promise<void>;
    beforeUpload?: (targetPath: string) => Promise<void>;
    afterUpload?: (repositoryUrl: string) => Promise<void>;
  };
}

export class F2GError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'F2GError';
  }
}

export class ValidationError extends F2GError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class GitHubError extends F2GError {
  constructor(message: string, public statusCode?: number) {
    super(message, 'GITHUB_ERROR');
    this.name = 'GitHubError';
  }
}

export class AnalysisError extends F2GError {
  constructor(message: string, public sourcePath?: string) {
    super(message, 'ANALYSIS_ERROR');
    this.name = 'AnalysisError';
  }
}