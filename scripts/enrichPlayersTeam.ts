import { enrichVerifiedPlayers } from '../src/services/footballData/verifiedEnrichmentService';

function parseArg(prefix: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`--${prefix}=`));
  return arg?.split('=').slice(1).join('=');
}

async function main() {
  const teamId = parseArg('teamId');
  const country = parseArg('country');
  if (!teamId && !country) {
    console.error('Uso: npm run enrich:players:team -- --teamId=<uuid> | --country=Brazil');
    process.exit(1);
  }

  const opts = {
    teamId,
    country,
    batchSize: parseArg('batchSize') ? Number(parseArg('batchSize')) : undefined,
    onlyMissingPhotos: process.argv.includes('--missing-photos'),
  };

  console.log(`\n=== enrich:players:team (verified) ===`);
  console.log(opts, '\n');

  const result = await enrichVerifiedPlayers(opts);
  console.log(`Escaneados: ${result.scanned}`);
  console.log(`Enriquecidos: ${result.enriched}`);
  console.log(`Conflictos: ${result.conflicts}`);
  console.log(`Saltados: ${result.skipped}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
