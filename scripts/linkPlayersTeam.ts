import { linkPlayerIdentities } from '../src/services/footballData/playerIdentityLinkingService';



function parseArg(prefix: string): string | undefined {

  const arg = process.argv.find(a => a.startsWith(`--${prefix}=`));

  return arg?.split('=').slice(1).join('=');

}



async function main() {

  const teamId = parseArg('teamId');

  const country = parseArg('country');

  if (!teamId && !country) {

    console.error('Uso: npm run link:players:team -- --teamId=<uuid> | --country=Argentina');

    process.exit(1);

  }



  const opts = {

    teamId,

    country,

    skipVerified: !process.argv.includes('--include-verified'),

    batchSize: parseArg('batchSize') ? Number(parseArg('batchSize')) : undefined,

    dryRun: process.argv.includes('--dry-run'),

  };



  console.log(`\n=== link:players:team ===`);

  console.log(opts, '\n');



  const summary = await linkPlayerIdentities(opts);

  console.log(`Escaneados: ${summary.scanned}`);

  console.log(`Verificados: ${summary.verified}`);

  console.log(`Needs review: ${summary.needsReview}`);

  console.log(`Rechazados: ${summary.rejected}`);

}



main().catch(err => {

  console.error(err);

  process.exit(1);

});

