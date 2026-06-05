import { FootballDataProvider, FootballDataHttpError } from '../src/providers/footballData/FootballDataProvider';
import { SyncEngine } from '../src/services/sync/SyncEngine';
import { printRateLimit, printSyncReport } from '../src/services/sync/syncReport';

const ENDPOINT = `${process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4'}/competitions/${process.env.FOOTBALL_DATA_WORLD_CUP_CODE || 'WC'}/teams`;

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

    const raw = await FootballDataProvider.fetchTeamsRaw();
    report.status = raw.status;
    report.recordsFetched = ((raw.data as { teams?: unknown[] }).teams ?? []).length;

    const teams = await FootballDataProvider.syncTeams();
    report.recordsNormalized = teams.length;

    if (teams.length > 0) {
      await SyncEngine.upsertAndCache('teams', teams, 'cache:teams:football_data', 86400, 'provider,provider_team_id');
      report.recordsUpserted = teams.length;
    }
  } catch (err) {
    if (err instanceof FootballDataHttpError && err.status === 429) {
      printRateLimit(err.retryAfter);
    }
    report.errors.push(
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : JSON.stringify(err)
    );
    report.status = err instanceof FootballDataHttpError ? err.status : 'error';
  }

  printSyncReport(report);
  process.exit(report.errors.length ? 1 : 0);
}

main();
