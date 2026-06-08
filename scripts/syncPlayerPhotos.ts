import { syncMissingPlayerPhotos } from '../src/services/footballData/photoService.js';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

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
