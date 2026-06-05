/**
 * Genera reports/knockout-audit.json — npm run audit:knockout
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { getKnockoutAuditReport } from '../src/services/knockout/knockoutQualificationService.js';

async function main() {
  console.log('Auditoría knockout PRODEMUNDIAL 2026…\n');
  const report = await getKnockoutAuditReport();

  console.log(`Grupos completos: ${report.groupsComplete.length}/12`);
  console.log(`Grupos pendientes: ${report.groupsPending.join(', ') || '—'}`);
  console.log(`Partidos resueltos: ${report.matchesResolved}/32`);
  console.log(`Partidos pendientes: ${report.matchesPending}`);
  console.log(`Predicciones habilitadas: ${report.predictionsEnabled}`);
  if (report.qualifiers?.combinationKey) {
    console.log(`Combinación terceros (Annex C): ${report.qualifiers.combinationKey}`);
  }
  if (report.errors.length) {
    console.log('\nErrores:');
    report.errors.forEach(e => console.log(`  - ${e}`));
  }

  mkdirSync('reports', { recursive: true });
  const outPath = 'reports/knockout-audit.json';
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReporte guardado en ${outPath}`);
}

main().catch(err => {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
