import { readFileSync, existsSync } from 'node:fs';
import enrichPlayerDetails from '../src/services/sync/enrichPlayerDetails.js';

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
loadEnvFile('.env.local');

async function main() {
  const limit = Number(process.argv[2] || process.env.ENRICH_PLAYERS_LIMIT || 60);
  console.log(`PRODEMUNDIAL enrich:player-details (limit=${limit})\n`);

  const result = await enrichPlayerDetails({ limit });
  console.log(`Scanned: ${result.scanned}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors:  ${result.errors}`);
}

main().catch(err => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
