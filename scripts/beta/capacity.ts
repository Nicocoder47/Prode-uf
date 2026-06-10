import { buildBetaReport, collectBetaMetrics, persistCapacitySnapshot, writeBetaReport } from '../lib/betaMetrics.js';

async function main() {
  console.log('\n=== BETA CAPACITY ===\n');
  const metrics = await collectBetaMetrics();
  const report = buildBetaReport(metrics);
  writeBetaReport('beta-capacity.json', report);
  await persistCapacitySnapshot(report);

  console.log(`Usuarios: ${metrics.total_users} | Activos 7d: ${metrics.active_users_7d}`);
  console.log(`Predicciones: ${metrics.total_predictions} | Jugaron: ${metrics.users_played_pct}%`);
  console.log(`Semáforo: ${report.evaluation.status.toUpperCase()} — ${report.recommended_action}`);
  console.log(`Costo $0 viable: ${report.cost_zero_viable ? 'SÍ' : 'NO'}\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
