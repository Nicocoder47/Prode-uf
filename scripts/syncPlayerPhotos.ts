import { readFileSync, existsSync } from 'node:fs';
import { syncMissingPlayerPhotos } from '../src/services/footballData/photoService.js';

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
  console.log('PRODEMUNDIAL sync:player-photos\n');
  const limit = Number(process.env.PHOTO_SYNC_LIMIT || 40);
  const updated = await syncMissingPlayerPhotos(limit);
  console.log(`✅ Fotos actualizadas: ${updated}`);
}

main().catch(err => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
