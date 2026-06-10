import { collectBetaMetrics, buildBetaReport, writeBetaReport } from '../lib/betaMetrics.js';
import { BETA300_STATUS_LABELS } from '../../src/utils/beta300Capacity.ts';

async function main() {
  console.log('\n=== BETA MIGRATION CHECK ===\n');
  const metrics = await collectBetaMetrics();
  const report = buildBetaReport(metrics);
  writeBetaReport('beta-migration-check.json', report);

  const e = report.evaluation;
  console.log(BETA300_STATUS_LABELS[e.status]);
  console.log(`Recomendación: ${e.message}`);
  if (report.thresholds_exceeded.length) {
    console.log('Umbrales:');
    for (const t of report.thresholds_exceeded) console.log(`  - ${t}`);
  }
  console.log(`\nPagar primero si migrás: Supabase Pro (~$25/mes) + Render Worker (~$7/mes)`);
  console.log(`NO pagar aún: Redis, Vercel Pro (salvo evidencia)\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
