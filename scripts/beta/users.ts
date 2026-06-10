import { collectBetaMetrics, writeBetaReport, buildBetaReport } from '../lib/betaMetrics.js';

async function main() {
  console.log('\n=== BETA USERS ===\n');
  const metrics = await collectBetaMetrics();
  const report = buildBetaReport(metrics, {
    recommended_action: `Registrados: ${metrics.total_users} | Nuevos hoy: ${metrics.new_users_today} | 7d: ${metrics.new_users_7d}`,
  });
  writeBetaReport('beta-users.json', report);

  console.log(`Total registrados: ${metrics.total_users}`);
  console.log(`Nuevos hoy: ${metrics.new_users_today}`);
  console.log(`Nuevos 7d: ${metrics.new_users_7d} | 30d: ${metrics.new_users_30d}`);
  console.log(`Con predicción: ${metrics.users_with_predictions} (${metrics.users_played_pct}%)\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
