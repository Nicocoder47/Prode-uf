import { enrichVerifiedPlayers } from '../src/services/footballData/verifiedEnrichmentService';

function parseArg(prefix: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`--${prefix}=`));
  return arg?.split('=').slice(1).join('=');
}

async function main() {
  const opts = {
    batchSize: parseArg('batchSize') ? Number(parseArg('batchSize')) : 50,
    onlyMissingPhotos: true,
    resume: process.argv.includes('--resume'),
    teamId: parseArg('teamId'),
    country: parseArg('country'),
  };

  console.log('\n=== enrich:players:missing-photos (verified only) ===');
  console.log(opts, '\n');

  const result = await enrichVerifiedPlayers(opts);
  console.log(`Escaneados: ${result.scanned}`);
  console.log(`Enriquecidos: ${result.enriched}`);
  console.log(`Conflictos: ${result.conflicts}`);
  console.log(`Saltados: ${result.skipped}`);
  console.log(`Errores: ${result.errors}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
