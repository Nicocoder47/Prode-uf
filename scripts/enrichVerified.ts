import { enrichVerifiedPlayers } from '../src/services/footballData/verifiedEnrichmentService';



function parseArg(prefix: string): string | undefined {

  const arg = process.argv.find(a => a.startsWith(`--${prefix}=`));

  return arg?.split('=').slice(1).join('=');

}



async function main() {

  const opts = {

    teamId: parseArg('teamId'),

    limit: parseArg('limit') ? Number(parseArg('limit')) : undefined,

    batchSize: parseArg('batchSize') ? Number(parseArg('batchSize')) : undefined,

    onlyMissingPhotos: process.argv.includes('--missing-photos'),

    resume: process.argv.includes('--resume'),

    allTeams: process.argv.includes('--all'),

  };



  console.log(`\n=== enrich:players:verified ===`);

  console.log(opts, '\n');



  const result = await enrichVerifiedPlayers(opts);

  console.log(`Escaneados: ${result.scanned}`);

  console.log(`Enriquecidos: ${result.enriched}`);

  console.log(`Conflictos: ${result.conflicts}`);

  console.log(`Saltados: ${result.skipped}`);

  console.log(`Errores: ${result.errors}`);

  console.log('\nReporte: reports/enrich-verified.json');

}



main().catch(err => {

  console.error(err);

  process.exit(1);

});

