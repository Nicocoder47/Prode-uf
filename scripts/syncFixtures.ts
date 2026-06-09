import { resolveSportsDataProvider } from '../src/services/sync/DataProviderManager';
import { SyncEngine } from '../src/services/sync/SyncEngine';
import { printSyncReport } from '../src/services/sync/syncReport';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('Configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (GitHub Secrets o .env.cloud)');
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL?.trim() && process.env.VITE_SUPABASE_URL?.trim()) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL.trim();
  }
  if (!process.env.FOOTBALL_DATA_API_KEY?.trim() && !process.env.API_FOOTBALL_KEY?.trim()) {
    console.error('Configurar FOOTBALL_DATA_API_KEY o API_FOOTBALL_KEY (GitHub Secrets o .env.cloud)');
    process.exit(1);
  }
  let provider;
  try {
    provider = resolveSportsDataProvider();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const report = {
    provider: provider.name,
    endpoint: 'syncFixtures()',
    status: 'ok',
    recordsFetched: 0,
    recordsNormalized: 0,
    recordsUpserted: 0,
    errors: [] as string[],
  };

  try {
    const fixtures = await provider.syncFixtures();
    report.recordsFetched = fixtures.length;
    report.recordsNormalized = fixtures.length;
    if (fixtures.length > 0) {
      await SyncEngine.upsertAndCache('matches', fixtures, `cache:matches:${provider.name}`, 86400, 'provider,provider_match_id');
      report.recordsUpserted = fixtures.length;
    }
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    report.status = 'error';
  }

  printSyncReport(report);
  process.exit(report.errors.length ? 1 : 0);
}

main();
