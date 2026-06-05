import { FootballDataProvider, FootballDataHttpError } from '../src/providers/footballData/FootballDataProvider';
import { SyncEngine } from '../src/services/sync/SyncEngine';
import { printRateLimit, printSyncReport } from '../src/services/sync/syncReport';

const ENDPOINT = `${process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4'}/competitions/${process.env.FOOTBALL_DATA_WORLD_CUP_CODE || 'WC'}/matches`;

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

    const raw = await FootballDataProvider.fetchMatchesRaw();
    report.status = raw.status;
    report.recordsFetched = ((raw.data as { matches?: unknown[] }).matches ?? []).length;

    const fixtures = await FootballDataProvider.syncFixtures();
    report.recordsNormalized = fixtures.length;

    if (fixtures.length > 0) {
      await SyncEngine.upsertAndCache('matches', fixtures, 'cache:matches:football_data', 86400, 'provider,provider_match_id');
      report.recordsUpserted = fixtures.length;
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
