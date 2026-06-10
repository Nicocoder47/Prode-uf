import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BetaReport } from '../lib/betaMetrics.js';
import { collectBetaMetrics, buildBetaReport, writeBetaReport } from '../lib/betaMetrics.js';
import { initLoadEnv } from '../load/lib/loadEnv.js';

function readReport(name: string) {
  const p = join(process.cwd(), 'reports', name);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

async function main() {
  console.log('\n=== BETA HEALTH ===\n');
  const { url } = initLoadEnv();
  const metrics = await collectBetaMetrics();

  const health = {
    supabase_url_configured: Boolean(url),
    last_sync_status: metrics.last_sync?.status ?? 'unknown',
    recent_sync_errors_24h: metrics.recent_sync_errors_24h,
    load_read_api: readReport('load-read-api.json'),
    load_save_prediction: readReport('load-save-prediction.json'),
    load_realtime_estimate: readReport('load-realtime-estimate.json'),
    prelaunch_audit: readReport('prelaunch-audit-raw.json'),
  };

  const report = buildBetaReport(metrics, {
    recommended_action:
      metrics.recent_sync_errors_24h > 0
        ? 'Revisar errores de sync en últimas 24h'
        : 'Salud operativa dentro de beta',
  });

  writeBetaReport('beta-health.json', { ...report, health } as BetaReport & { health: typeof health });

  console.log(`Sync reciente: ${health.last_sync_status}`);
  console.log(`Errores sync 24h: ${metrics.recent_sync_errors_24h}`);
  console.log(`Semáforo: ${report.evaluation.status}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
