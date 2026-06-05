/**
 * Genera reports/live-events-audit.json — npm run audit:live-events
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { getLiveEventsAuditReport } from '../server/services/systemHealthService.js';

async function main() {
  console.log('Auditoría de eventos live…\n');
  const report = await getLiveEventsAuditReport();

  console.log(`Total eventos (muestra): ${report.summary.totalEvents}`);
  console.log(`Goles: ${report.summary.goals}`);
  console.log(`Con player_id: ${report.summary.withPlayerId}`);
  console.log(`Sin player_id: ${report.summary.withoutPlayerId}`);
  console.log(`Goles sin resolver: ${report.summary.unresolvedGoals.length}`);
  console.log(`Partidos live auditados: ${report.liveMatches.length}`);

  mkdirSync('reports', { recursive: true });
  const outPath = 'reports/live-events-audit.json';
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReporte guardado en ${outPath}`);
}

main().catch(err => {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
