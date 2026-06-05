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

    const { players, squadsAvailable } = await FootballDataProvider.syncPlayers();
    report.recordsNormalized = players.length;

    if (players.length > 0) {
      await SyncEngine.upsertAndCache('players', players, 'cache:players:football_data', 86400, 'provider,provider_player_id');
      report.recordsUpserted = players.length;
    } else if (!squadsAvailable) {
      console.log('\nfootball-data.org no entrega planteles en este plan/competencia.');
      console.log('Agregar TheSportsDB como fuente secundaria para jugadores y fotos.');
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
