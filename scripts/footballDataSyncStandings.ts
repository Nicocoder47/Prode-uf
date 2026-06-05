import { FootballDataProvider, FootballDataHttpError } from '../src/providers/footballData/FootballDataProvider';
import { SyncEngine } from '../src/services/sync/SyncEngine';
import { printRateLimit, printSyncReport } from '../src/services/sync/syncReport';

const ENDPOINT = `${process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4'}/competitions/${process.env.FOOTBALL_DATA_WORLD_CUP_CODE || 'WC'}/standings`;

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

    const raw = await FootballDataProvider.fetchStandingsRaw();
    report.status = raw.status;
    report.recordsFetched = ((raw.data as { standings?: unknown[] }).standings ?? []).length;

    const rows = await FootballDataProvider.syncStandings();
    report.recordsNormalized = rows.length;

    if (rows.length > 0) {
      await SyncEngine.upsertAndCache(
        'standings',
        rows,
        'cache:standings:football_data',
        3600,
        'team_id,group_label,phase,provider'
      );
      report.recordsUpserted = rows.length;
      const { syncTeamGroupsFromStandings } = await import('../src/services/sync/syncTeamGroups');
      const updated = await syncTeamGroupsFromStandings();
      console.log(`[SYNC] group_label actualizado en ${updated} equipos`);
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
