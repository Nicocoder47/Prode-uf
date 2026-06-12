/**
 * Sync de partidos en vivo / resultados — una ejecución (GitHub Actions cada 10 min).
 * npm run sync:live
 */
import { loadCloudEnv } from './lib/loadCloudEnv.js';
import { runLiveSyncCycle } from '../src/services/sync/liveWorkerService.js';

loadCloudEnv();

async function main() {
  if (!process.env.SUPABASE_URL?.trim() && process.env.VITE_SUPABASE_URL?.trim()) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL.trim();
  }
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('Configurar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (GitHub Secrets o .env.cloud)');
    process.exit(1);
  }
  if (!process.env.FOOTBALL_DATA_API_KEY?.trim() && !process.env.API_FOOTBALL_KEY?.trim()) {
    console.error('Configurar FOOTBALL_DATA_API_KEY o API_FOOTBALL_KEY (GitHub Secrets o .env.cloud)');
    process.exit(1);
  }
  if (/localhost|127\.0\.0\.1|:54321/.test(process.env.SUPABASE_URL)) {
    console.error('SUPABASE_URL apunta a local — usar cloud en producción');
    process.exit(1);
  }

  const providerHint = process.env.FOOTBALL_DATA_API_KEY?.trim()
    ? 'football-data.org (prioridad)'
    : 'api-football';

  console.log('[SYNC:live] Inicio', {
    supabase: process.env.SUPABASE_URL.replace(/https?:\/\//, '').split('.')[0],
    provider: providerHint,
    apiFootball: Boolean(process.env.API_FOOTBALL_KEY?.trim()),
    at: new Date().toISOString(),
  });

  const result = await runLiveSyncCycle();

  console.log('[SYNC:live] Resumen', {
    ok: result.ok,
    critical: result.critical,
    provider: result.primaryProvider,
    liveMatchesUpserted: result.liveMatchesUpserted,
    todayResultsFetched: result.todayResultsFetched,
    todayResultsUpserted: result.todayResultsUpserted,
    liveBundlesProcessed: result.liveBundlesProcessed,
    errors: result.errors,
    warnings: result.warnings,
    durationMs: result.durationMs,
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.critical) {
    console.error('[SYNC:live] Fallo crítico en today_results — exit 1');
    process.exit(1);
  }
  if (result.warnings.length > 0) {
    console.warn('[SYNC:live] Advertencias no críticas:', result.warnings.join('; '));
  }
  process.exit(0);
}

main().catch(err => {
  console.error('[SYNC:live] Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
