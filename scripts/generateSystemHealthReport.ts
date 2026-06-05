/**
 * Genera reports/system-health.json — npm run audit:system-health
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { getSystemHealthReport } from '../server/services/systemHealthService.js';

async function main() {
  console.log('Generando reporte de salud del sistema…\n');
  const report = await getSystemHealthReport();

  console.log(`Worker: ${report.worker.status} (último heartbeat: ${report.worker.lastHeartbeatAt ?? '—'})`);
  console.log(`Partidos live: ${report.live.liveMatches}`);
  console.log(`Eventos: ${report.live.totalEvents} (${report.live.playerIdCoveragePct}% con player_id)`);
  console.log(`Errores recientes: ${report.sync.recentErrors.length}`);

  mkdirSync('reports', { recursive: true });
  const outPath = 'reports/system-health.json';
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReporte guardado en ${outPath}`);
}

main().catch(err => {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
