import { resolveSportsDataProvider } from '../src/services/sync/DataProviderManager';
import { SyncEngine } from '../src/services/sync/SyncEngine';
import { printSyncReport } from '../src/services/sync/syncReport';
import { ApiFootballProvider } from '../src/providers/apiFootball/ApiFootballProvider';

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
    endpoint: 'syncTeams()',
    status: 'ok',
    recordsFetched: 0,
    recordsNormalized: 0,
    recordsUpserted: 0,
    errors: [] as string[],
  };

  try {
    const teams = await provider.syncTeams();
    report.recordsFetched = teams.length;
    report.recordsNormalized = teams.length;
    if (teams.length > 0) {
      await SyncEngine.upsertAndCache('teams', teams, `cache:teams:${provider.name}`, 86400, 'provider,provider_team_id');
      report.recordsUpserted = teams.length;
    }

    if (provider.name === 'api-football' && ApiFootballProvider.isConfigured()) {
      console.log('\n▶ Enriqueciendo metadata de equipos (DT + confederación)...');
      const meta = await ApiFootballProvider.enrichStoredTeamsMetadata();
      console.log(`  Actualizados: ${meta.updated} · DT: ${meta.coaches} · Conf: ${meta.confederations}`);
    }
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    report.status = 'error';
  }

  printSyncReport(report);
  process.exit(report.errors.length ? 1 : 0);
}

main();
