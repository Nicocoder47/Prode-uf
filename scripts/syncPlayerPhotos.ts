import { syncAllMissingPlayerPhotos, countPlayersMissingPhotos } from '../src/services/footballData/photoService.js';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

async function main() {
  const batchSize = Number(process.env.PHOTO_SYNC_LIMIT || 50);
  const maxPlayers = Number(process.env.PHOTO_SYNC_MAX || 5000);
  const teamId = process.env.PHOTO_SYNC_TEAM_ID;

  const before = await countPlayersMissingPhotos(teamId || undefined);
  console.log(`PRODEMUNDIAL sync:player-photos`);
  console.log(`Jugadores sin foto: ${before}`);
  if (teamId) console.log(`Equipo: ${teamId}`);
  console.log(`Lote: ${batchSize} · máx: ${maxPlayers}\n`);

  const result = await syncAllMissingPlayerPhotos({
    batchSize,
    maxPlayers,
    teamId: teamId || undefined,
    skipApiFootballSquads: true,
  });

  console.log(`\n✅ API-Football squads: +${result.apiFootballUpdated}`);
  console.log(`✅ Fotos nuevas: ${result.updated} (escaneados ${result.scanned})`);
  console.log(`⏳ Sin foto restantes: ${result.remaining}`);
}

main().catch(err => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
