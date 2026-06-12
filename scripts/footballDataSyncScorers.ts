import { FootballDataProvider, FootballDataHttpError } from '../src/providers/footballData/FootballDataProvider';
import { syncFootballDataScorers } from '../src/services/sync/scorersSync';
import { printRateLimit, printSyncReport } from '../src/services/sync/syncReport';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

const wcCode = process.env.FOOTBALL_DATA_WORLD_CUP_CODE || 'WC';
const ENDPOINT = `${process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4'}/competitions/${wcCode}/scorers`;

async function main() {
  const report = {
    provider: 'football-data.org',
    endpoint: ENDPOINT,
    status: 'pending',
    recordsFetched: 0,
    recordsNormalized: 0,
    recordsUpserted: 0,
    errors: [] as string[],
  };

  try {
    if (!FootballDataProvider.isConfigured()) {
      throw new Error('FOOTBALL_DATA_API_KEY not configured');
    }

    const result = await syncFootballDataScorers(50);
    report.status = result.ok ? 200 : 'error';
    report.recordsFetched = result.fetched;
    report.recordsNormalized = result.upserted + result.skipped;
    report.recordsUpserted = result.upserted;
    if (result.errors.length > 0) {
      report.errors.push(...result.errors);
    }
  } catch (err) {
    if (err instanceof FootballDataHttpError && err.status === 429) {
      printRateLimit(err.retryAfter);
    }
    report.errors.push(err instanceof Error ? err.message : String(err));
    report.status = err instanceof FootballDataHttpError ? err.status : 'error';
  }

  printSyncReport(report);
  process.exit(report.errors.length ? 1 : 0);
}

main();
