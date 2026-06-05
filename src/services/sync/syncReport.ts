export interface SyncReport {
  provider: string;
  endpoint: string;
  status: number | string;
  recordsFetched: number;
  recordsNormalized: number;
  recordsUpserted: number;
  errors: string[];
}

export function printSyncReport(report: SyncReport) {
  console.log('');
  console.log('--- Sync Report ---');
  console.log(`Provider: ${report.provider}`);
  console.log(`Endpoint: ${report.endpoint}`);
  console.log(`Status: ${report.status}`);
  console.log(`Records fetched: ${report.recordsFetched}`);
  console.log(`Records normalized: ${report.recordsNormalized}`);
  console.log(`Records upserted: ${report.recordsUpserted}`);
  if (report.errors.length > 0) {
    console.log(`Errors: ${report.errors.join(' | ')}`);
  } else {
    console.log('Errors: none');
  }
  console.log('-------------------');
}

export function printRateLimit(retryAfter?: string) {
  console.error('Rate limit detected.');
  console.error(`Retry after: ${retryAfter ?? 'unknown'}`);
}
