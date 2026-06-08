/**
 * Sincroniza fotos faltantes contra Supabase cloud (Wikimedia + TheSportsDB).
 * npm run sync:photos:cloud
 */
import { loadCloudEnv } from './lib/loadCloudEnv.js';
import { syncMissingPlayerPhotos } from '../src/services/footballData/photoService.js';

loadCloudEnv();

async function main() {
  const batchSize = Number(process.env.PHOTO_SYNC_LIMIT || 30);
  const maxBatches = Number(process.env.PHOTO_SYNC_BATCHES || 10);
  let total = 0;

  console.log(`PRODEMUNDIAL · sync:photos:cloud (${batchSize} × ${maxBatches} lotes max)\n`);

  for (let i = 1; i <= maxBatches; i++) {
    const updated = await syncMissingPlayerPhotos(batchSize);
    total += updated;
    console.log(`  Lote ${i}/${maxBatches}: +${updated} fotos (total ${total})`);
    if (updated === 0) break;
  }

  console.log(`\n✅ Fotos actualizadas en cloud: ${total}`);
}

main().catch(err => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
