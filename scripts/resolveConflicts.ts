import { resolvePlayerConflicts } from '../src/services/footballData/playerConflictResolver';

function parseArg(prefix: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`--${prefix}=`));
  return arg?.split('=').slice(1).join('=');
}

async function main() {
  const opts = {
    teamId: parseArg('teamId'),
    limit: parseArg('limit') ? Number(parseArg('limit')) : undefined,
  };

  console.log(`\n=== resolve:players:conflicts ===`);
  console.log(opts, '\n');

  const summary = await resolvePlayerConflicts(opts);
  console.log(`Escaneados: ${summary.scanned}`);
  console.log(`Con conflictos: ${summary.withConflicts}`);
  console.log(`Bloqueados: ${summary.blocked}`);
  console.log('\nReportes: reports/player-conflicts.{json,md}');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
