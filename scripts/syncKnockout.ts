/**
 * Sincroniza bracket knockout — npm run sync:knockout
 */
import { syncKnockoutBracket } from '../src/services/knockout/knockoutQualificationService.js';

async function main() {
  console.log('Sync knockout PRODEMUNDIAL 2026…\n');
  const result = await syncKnockoutBracket({ force: false });

  console.log(`Upserted: ${result.matchesUpserted} partidos`);
  console.log(`Resueltos: ${result.matchesResolved} | Pendientes: ${result.matchesPending}`);
  console.log(`Predicciones abiertas: ${result.predictionsEnabled}`);
  console.log(`Grupos completos: ${result.groupsComplete.length}/12`);

  if (result.errors.length) {
    console.log('\nErrores:');
    result.errors.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FAIL', err instanceof Error ? err.message : err);
  process.exit(1);
});
