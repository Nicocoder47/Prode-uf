import { linkPlayerIdentities } from '../src/services/footballData/playerIdentityLinkingService';



function parseArg(prefix: string): string | undefined {

  const arg = process.argv.find(a => a.startsWith(`--${prefix}=`));

  return arg?.split('=').slice(1).join('=');

}



async function main() {

  const opts = {

    teamId: parseArg('teamId'),

    country: parseArg('country'),

    resume: process.argv.includes('--resume'),

    dryRun: process.argv.includes('--dry-run'),

    limit: parseArg('limit') ? Number(parseArg('limit')) : undefined,

    batchSize: parseArg('batchSize') ? Number(parseArg('batchSize')) : undefined,

    skipVerified: !process.argv.includes('--include-verified'),

    allTeams: process.argv.includes('--all'),

  };



  console.log(`\n=== link:players:identities ===`);

  console.log(opts, '\n');



  const summary = await linkPlayerIdentities(opts);

  console.log(`Escaneados: ${summary.scanned}`);

  console.log(`Verificados: ${summary.verified}`);

  console.log(`Needs review: ${summary.needsReview}`);

  console.log(`Possible match: ${summary.possibleMatch}`);

  console.log(`Rechazados: ${summary.rejected}`);

  console.log(`Sin candidatos: ${summary.noCandidates}`);

  console.log('\nReportes: reports/player-identity-linking.{json,md} | reports/player-identity-conflicts.json');

}



main().catch(err => {

  console.error(err);

  process.exit(1);

});

