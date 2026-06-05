import { resolveSportsDataProvider } from '../src/services/sync/DataProviderManager';
import { SyncEngine } from '../src/services/sync/SyncEngine';
import { printSyncReport } from '../src/services/sync/syncReport';

async function main() {
  let provider;
  try {
    provider = resolveSportsDataProvider();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const report = {
    provider: provider.name,
    endpoint: 'syncPlayers()',
    status: 'ok',
    recordsFetched: 0,
    recordsNormalized: 0,
    recordsUpserted: 0,
    errors: [] as string[],
  };

  try {
    const players = await provider.syncPlayers();
    report.recordsFetched = players.length;
    report.recordsNormalized = players.length;
    if (players.length > 0) {
      await SyncEngine.upsertAndCache('players', players, `cache:players:${provider.name}`, 86400, 'provider,provider_player_id');
      report.recordsUpserted = players.length;
    } else if (provider.name === 'football-data.org') {
      console.log('\nfootball-data.org no entrega planteles en este plan/competencia.');
      console.log('Agregar TheSportsDB como fuente secundaria para jugadores y fotos.');
    }
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    report.status = 'error';
  }

  printSyncReport(report);
  process.exit(report.errors.length ? 1 : 0);
}

main();
