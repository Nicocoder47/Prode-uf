import { SofascoreProvider } from '../src/providers/sofascore/SofascoreProvider';
import { SyncEngine } from '../src/services/sync/SyncEngine';

async function main() {
  console.log('🚀 Sincronización de Ratings (Sofascore)...');
  const rows = await SofascoreProvider.syncPlayerRatings('all');
  if (rows.length > 0) {
    await SyncEngine.upsertAndCache(
      'player_ratings',
      rows,
      'cache:ratings:all',
      1800,
      'player_id,match_id,source'
    );
    console.log(`✅ ${rows.length} ratings guardados.`);
  } else {
    console.log('ℹ️ Sin ratings (Sofascore no configurado o sin partidos mapeados).');
  }
  process.exit(0);
}

main();
