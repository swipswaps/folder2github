import { Octokit } from '@octokit/rest';
import { logger } from './logger.js';

export interface GitHubRepoOptions {
  name: string;
  description: string;
  private: boolean;
  topics: string[];
  features: string[];
  homepage?: string;
  hasIssues: boolean;
  hasProjects: boolean;
  hasWiki: boolean;
  allowSquashMerge: boolean;
  allowMergeCommit: boolean;
  allowRebaseMerge: boolean;
  deleteBranchOnMerge: boolean;
}

export class GitHubManager {
  constructor(private octokit: Octokit, private username: string) {}

  async createRepository(options: GitHubRepoOptions): Promise<any> {
    logger.debug(`Creating GitHub repository: ${options.name}`);

    try {
      // Check if repository already exists
      await this.checkRepositoryExists(options.name);

      // Create repository
      const repo = await this.octokit.repos.createForAuthenticatedUser({
        name: options.name,
        description: options.description,
        private: options.private,
        auto_init: false,
        homepage: options.homepage,
        has_issues: options.hasIssues,
        has_projects: options.hasProjects,
        has_wiki: options.hasWiki,
        allow_squash_merge: options.allowSquashMerge,
        allow_merge_commit: options.allowMergeCommit,
        allow_rebase_merge: options.allowRebaseMerge,
        delete_branch_on_merge: options.deleteBranchOnMerge,
      });

      // Add topics
      if (options.topics.length > 0) {
        await this.setTopics(options.name, options.topics);
      }

      // Configure additional settings
      await this.configureRepository(options.name, options);

      return repo.data;
    } catch (error) {
      this.handleGitHubError(error);
    }
  }

  private async checkRepositoryExists(name: string): Promise<void> {
    try {
      await this.octokit.repos.get({
        owner: this.username,
        repo: name,
      });
      throw new Error(`Repository '${name}' already exists`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      // Repository doesn't exist, which is what we want
    }
  }

  async setTopics(repoName: string, topics: string[]): Promise<void> {
    // Validate and clean topics
    const validTopics = topics
      .map(topic => topic.toLowerCase().replace(/[^a-z0-9-]/g, ''))
      .filter(topic => topic.length > 0 && topic.length <= 35)
      .slice(0, 20); // GitHub limits to 20 topics

    if (validTopics.length > 0) {
      await this.octokit.repos.replaceAllTopics({
        owner: this.username,
        repo: repoName,
        names: validTopics,
      });
    }
  }

  private async configureRepository(repoName: string, options: GitHubRepoOptions): Promise<void> {
    // Enable vulnerability alerts
    try {
      await this.octokit.repos.enableVulnerabilityAlerts({
        owner: this.username,
        repo: repoName,
      });
    } catch {
      // Ignore if not available
    }

    // Enable automated security fixes
    try {
      await this.octokit.repos.enableAutomatedSecurityFixes({
        owner: this.username,
        repo: repoName,
      });
    } catch {
      // Ignore if not available
    }

    // Configure branch protection if needed
    if (options.features.includes('branch-protection')) {
      await this.setupBranchProtection(repoName);
    }
  }

  private async setupBranchProtection(repoName: string): Promise<void> {
    try {
      await this.octokit.repos.updateBranchProtection({
        owner: this.username,
        repo: repoName,
        branch: 'main',
        required_status_checks: {
          strict: true,
          contexts: ['CI'],
        },
        enforce_admins: false,
        required_pull_request_reviews: {
          required_approving_review_count: 1,
          dismiss_stale_reviews: true,
        },
        restrictions: null,
      });
    } catch {
      // Branch protection might not be available for all account types
      logger.debug('Branch protection setup skipped');
    }
  }

  async getRepository(name: string): Promise<any> {
    const { data } = await this.octokit.repos.get({
      owner: this.username,
      repo: name,
    });
    return data;
  }

  async updateRepository(name: string, updates: Partial<GitHubRepoOptions>): Promise<any> {
    const { data } = await this.octokit.repos.update({
      owner: this.username,
      repo: name,
      ...updates,
    });
    return data;
  }

  async deleteRepository(name: string): Promise<void> {
    await this.octokit.repos.delete({
      owner: this.username,
      repo: name,
    });
  }

  async getRateLimit(): Promise<any> {
    const { data } = await this.octokit.rateLimit.get();
    return data;
  }

  private handleGitHubError(error: any): never {
    if (error.status === 401) {
      throw new Error('GitHub authentication failed. Check your token configuration.');
    } else if (error.status === 403) {
      throw new Error('GitHub API rate limit exceeded or insufficient permissions.');
    } else if (error.status === 422) {
      throw new Error(`GitHub API validation error: ${error.message}`);
    } else if (error.message?.includes('already exists')) {
      throw error;
    } else {
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }
}