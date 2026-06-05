import { linkCountries } from '../src/services/footballData/countryLinkingService';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`\n=== link:countries${dryRun ? ' (dry-run)' : ''} ===\n`);
  const summary = await linkCountries({ dryRun });
  console.log(`Total: ${summary.total}`);
  console.log(`Verificados: ${summary.verified}`);
  console.log(`Needs review: ${summary.needsReview}`);
  console.log(`Conflictos: ${summary.conflict}`);
  console.log(`Sin vínculo: ${summary.unlinked}`);
  console.log('\nReportes: reports/country-linking.json | reports/country-linking.md');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
