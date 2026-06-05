import { readFileSync, existsSync } from 'node:fs';
import { enrichPlayersBatch, enrichSinglePlayer } from '../src/services/footballData/playerEnrichmentService';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile('.env');

function parseArg(prefix: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`--${prefix}=`));
  return arg?.split('=').slice(1).join('=');
}

async function main() {
  const mode = process.argv[2] ?? 'real';
  const teamId = parseArg('teamId');
  const playerId = parseArg('playerId');

  console.log(`\n=== enrich:players:${mode} ===\n`);

  if (playerId) {
    const r = await enrichSinglePlayer(playerId);
    console.log(r);
    return;
  }

  const options = {
    teamId,
    resume: mode === 'resume' || process.argv.includes('--resume'),
    onlyMissingPhotos: mode === 'missing-photos',
    onlyMissingMarketValues: mode === 'missing-market-values',
  };

  const result = await enrichPlayersBatch(options);
  console.log(result);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
