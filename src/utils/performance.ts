import { performance } from 'perf_hooks';
import { logger } from './logger.js';

export class PerformanceMonitor {
  private timers: Map<string, number> = new Map();
  private metrics: Map<string, number[]> = new Map();

  start(label: string): void {
    this.timers.set(label, performance.now());
  }

  end(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      logger.warning(`Performance timer '${label}' was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(label);

    // Store metric for analysis
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);

    logger.debug(`${label}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  getMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    for (const [label, times] of this.metrics.entries()) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      
      result[label] = { avg, min, max, count: times.length };
    }

    return result;
  }

  reset(): void {
    this.timers.clear();
    this.metrics.clear();
  }
}

export const perf = new PerformanceMonitor();