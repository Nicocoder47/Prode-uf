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
    endpoint: 'syncStandings()',
    status: 'ok',
    recordsFetched: 0,
    recordsNormalized: 0,
    recordsUpserted: 0,
    errors: [] as string[],
  };

  try {
    const rows = await provider.syncStandings();
    report.recordsFetched = rows.length;
    report.recordsNormalized = rows.length;
    if (rows.length > 0) {
      await SyncEngine.upsertAndCache(
        'standings',
        rows,
        `cache:standings:${provider.name}`,
        3600,
        'team_id,group_label,phase,provider'
      );
      report.recordsUpserted = rows.length;
    }
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    report.status = 'error';
  }

  printSyncReport(report);
  process.exit(report.errors.length ? 1 : 0);
}

main();
