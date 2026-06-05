/**
 * Base Provider Interface
 * All data providers must implement this interface
 */

export interface DataSyncResult {
  success: boolean;
  provider: string;
  entity: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  errors: SyncError[];
  duration: number; // ms
  timestamp: Date;
}

export interface SyncError {
  code: string;
  message: string;
  details?: any;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected name: string;

  constructor(name: string, config: ProviderConfig) {
    this.name = name;
    this.config = config;
  }

  /**
   * Get provider name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Retry logic with exponential backoff
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    attempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempts <= 1) throw error;

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retry(fn, attempts - 1, delay * 2);
    }
  }

  /**
   * Normalize provider data
   */
  protected abstract normalizeData(data: any): any;

  /**
   * Validate data
   */
  protected abstract validateData(data: any): boolean;

  /**
   * Log sync operation
   */
  protected logSync(
    result: DataSyncResult
  ): void {
    console.log(`[${this.name}] Sync complete:`, {
      entity: result.entity,
      processed: result.recordsProcessed,
      created: result.recordsCreated,
      updated: result.recordsUpdated,
      errors: result.errors.length,
      duration: `${result.duration}ms`,
    });
  }
}
