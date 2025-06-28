import { chromium, Browser, Page } from 'playwright';
import { VerificationResult } from './types.js';

export class ModernVerifier {
  private browser?: Browser;
  private page?: Page;

  async verify(repositoryUrl: string): Promise<VerificationResult> {
    const startTime = Date.now();
    
    try {
      await this.initBrowser();
      
      const result: VerificationResult = {
        timestamp: new Date().toISOString(),
        repositoryUrl,
        tests: {},
        overallStatus: 'SUCCESS',
        performance: {
          loadTime: 0,
          responseTime: 0,
        },
      };

      // Test repository accessibility
      await this.testRepositoryAccess(result);
      
      // Test essential files
      await this.testEssentialFiles(result);
      
      // Test repository metadata
      await this.testRepositoryMetadata(result);
      
      // Performance metrics
      result.performance.loadTime = Date.now() - startTime;
      
      // Calculate overall status
      this.calculateOverallStatus(result);
      
      return result;
      
    } finally {
      await this.cleanup();
    }
  }

  private async initBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    
    this.page = await this.browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
  }

  private async testRepositoryAccess(result: VerificationResult): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    
    try {
      const response = await this.page.goto(result.repositoryUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      
      if (response?.status() === 200) {
        result.tests.repository_access = {
          status: 'PASS',
          message: 'Repository is accessible',
          data: { statusCode: response.status() },
        };
      } else {
        result.tests.repository_access = {
          status: 'FAIL',
          message: `HTTP ${response?.status()}`,
        };
      }
    } catch (error) {
      result.tests.repository_access = {
        status: 'FAIL',
        message: `Failed to access repository: ${error}`,
      };
    }
  }

  private async testEssentialFiles(result: VerificationResult): Promise<void> {
    if (!this.page) return;
    
    const essentialFiles = ['README.md', 'LICENSE'];
    const foundFiles: string[] = [];
    
    for (const file of essentialFiles) {
      try {
        const fileLink = await this.page.locator(`a[title="${file}"]`).first();
        if (await fileLink.isVisible({ timeout: 5000 })) {
          foundFiles.push(file);
        }
      } catch {
        // File not found
      }
    }
    
    result.tests.essential_files = {
      status: foundFiles.length === essentialFiles.length ? 'PASS' : 'WARN',
      message: `Found ${foundFiles.length}/${essentialFiles.length} essential files`,
      data: { found: foundFiles, missing: essentialFiles.filter(f => !foundFiles.includes(f)) },
    };
  }

  private async testRepositoryMetadata(result: VerificationResult): Promise<void> {
    if (!this.page) return;
    
    try {
      // Check repository title
      const title = await this.page.locator('h1').first().textContent();
      
      // Check description
      const description = await this.page.locator('[data-pjax="#repo-content-pjax-container"] p').first().textContent();
      
      // Check topics/tags
      const topics = await this.page.locator('[data-ga-click="Repository, click topic"]').allTextContents();
      
      result.tests.metadata = {
        status: 'PASS',
        message: 'Repository metadata found',
        data: {
          title: title?.trim(),
          description: description?.trim(),
          topics,
        },
      };
    } catch (error) {
      result.tests.metadata = {
        status: 'WARN',
        message: `Could not extract metadata: ${error}`,
      };
    }
  }

  private calculateOverallStatus(result: VerificationResult): void {
    const tests = Object.values(result.tests);
    const passCount = tests.filter(t => t.status === 'PASS').length;
    const totalCount = tests.length;
    
    if (passCount === totalCount) {
      result.overallStatus = 'SUCCESS';
    } else if (passCount >= totalCount * 0.7) {
      result.overallStatus = 'PARTIAL';
    } else {
      result.overallStatus = 'FAILED';
    }
  }

  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}