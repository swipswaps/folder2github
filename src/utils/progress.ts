import { EventEmitter } from 'events';

export interface ProgressEvent {
  current: number;
  total: number;
  message?: string;
  percentage: number;
}

export class ProgressTracker extends EventEmitter {
  private current: number = 0;
  private total: number = 0;
  private message: string = '';

  setTotal(total: number): void {
    this.total = total;
    this.emit('progress', this.getProgress());
  }

  increment(message?: string): void {
    this.current++;
    if (message) {
      this.message = message;
    }
    this.emit('progress', this.getProgress());
  }

  setProgress(current: number, message?: string): void {
    this.current = current;
    if (message) {
      this.message = message;
    }
    this.emit('progress', this.getProgress());
  }

  getProgress(): ProgressEvent {
    return {
      current: this.current,
      total: this.total,
      message: this.message,
      percentage: this.total > 0 ? (this.current / this.total) * 100 : 0,
    };
  }

  reset(): void {
    this.current = 0;
    this.total = 0;
    this.message = '';
  }
}