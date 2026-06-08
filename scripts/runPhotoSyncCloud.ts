/**
 * Sincroniza fotos faltantes contra Supabase cloud (API-Football + TheSportsDB + Wikimedia).
 * npm run sync:photos:cloud
 */
import { loadCloudEnv } from './lib/loadCloudEnv.js';
import { syncAllMissingPlayerPhotos, countPlayersMissingPhotos } from '../src/services/footballData/photoService.js';

loadCloudEnv();

async function main() {
  const batchSize = Number(process.env.PHOTO_SYNC_LIMIT || 50);
  const maxPerRun = Number(process.env.PHOTO_SYNC_MAX || 200);
  const maxBatches = Number(process.env.PHOTO_SYNC_BATCHES || 20);

  const before = await countPlayersMissingPhotos();
  console.log(`PRODEMUNDIAL · sync:photos:cloud`);
  console.log(`Sin foto al inicio: ${before}`);
  console.log(`Lote ${batchSize} · ${maxPerRun}/corrida · hasta ${maxBatches} corridas\n`);

  let totalUpdated = 0;
  let totalApiFootball = 0;

  const { ApiFootballProvider } = await import('../src/providers/apiFootball/ApiFootballProvider.js');
  const { supabase } = await import('../src/database/supabaseClient.js');
  const { count } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'api_football');

  if ((count ?? 0) > 0 && ApiFootballProvider.isConfigured()) {
    try {
      totalApiFootball = await ApiFootballProvider.syncPlayerPhotos();
      console.log(`  API-Football squads: +${totalApiFootball} fotos\n`);
    } catch (err) {
      console.warn('  API-Football squads omitido:', err instanceof Error ? err.message : err);
    }
  }

  for (let i = 1; i <= maxBatches; i++) {
    const result = await syncAllMissingPlayerPhotos({
      batchSize,
      maxPlayers: maxPerRun,
      skipApiFootballSquads: true,
    });
    totalUpdated += result.updated;
    console.log(
      `  Corrida ${i}/${maxBatches}: +${result.updated} fotos · restantes ${result.remaining}`,
    );
    if (result.remaining === 0) break;
    if (result.updated === 0) break;
  }

  const after = await countPlayersMissingPhotos();
  console.log(`\n✅ API-Football squads total: ${totalApiFootball}`);
  console.log(`✅ Fotos nuevas total: ${totalUpdated}`);
  console.log(`📊 Sin foto: ${before} → ${after}`);
}

main().catch(err => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
