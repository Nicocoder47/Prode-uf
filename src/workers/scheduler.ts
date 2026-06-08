import cron from 'node-cron';
import '../database/supabaseClient.js';
import { SyncEngine } from '../services/sync/SyncEngine';
import { resolveSportsDataProvider } from '../services/sync/DataProviderManager';
import { runLiveSyncCycle, registerWorkerStartup } from '../services/sync/liveWorkerService';
import { syncKnockoutBracket } from '../services/knockout/knockoutQualificationService';
import { TransfermarktProvider } from '../providers/transfermarkt/TransfermarktProvider';
import enrichPlayerDetails from '../services/sync/enrichPlayerDetails';

function getProvider() {
  try {
    return resolveSportsDataProvider();
  } catch (err) {
    console.warn('[Scheduler]', err instanceof Error ? err.message : err);
    return null;
  }
}

cron.schedule('*/30 * * * * *', async () => {
  console.log(`[${new Date().toISOString()}] ⚡ Live sync cycle...`);
  const result = await SyncEngine.runWithRetry('Live Sync Cycle', () => runLiveSyncCycle());
  if (result) {
    console.log(
      `[Live] matches=${result.liveMatchesUpserted} bundles=${result.liveBundlesProcessed} ok=${result.ok}`
    );
    if (result.errors.length > 0) {
      console.warn('[Live] warnings:', result.errors.join(' | '));
    }
  }
});

cron.schedule('0 * * * *', async () => {
  const provider = getProvider();
  if (!provider) return;

  console.log(`🕒 Fixture & Standings (${provider.name})...`);
  await SyncEngine.runWithRetry('Fixture Sync', async () => {
    const fixtures = await provider.syncFixtures();
    if (fixtures.length > 0) {
      await SyncEngine.upsertAndCache('matches', fixtures, `cache:matches:all:${provider.name}`, 3600, 'provider,provider_match_id');
    }
    const standings = await provider.syncStandings();
    if (standings.length > 0) {
      await SyncEngine.upsertAndCache('standings', standings, `cache:standings:all:${provider.name}`, 3600, 'team_id,group_label,phase,provider');
    }
    const ko = await syncKnockoutBracket();
    if (ko.matchesUpserted > 0) {
      console.log(`🏆 Knockout sync: ${ko.matchesResolved} resueltos, ${ko.matchesPending} pendientes`);
    }
  });
});

cron.schedule('0 2 * * *', async () => {
  const provider = getProvider();
  if (!provider) return;

  console.log(`📅 Daily sync (${provider.name})...`);
  await SyncEngine.runWithRetry('Teams & Players', async () => {
    const teams = await provider.syncTeams();
    if (teams.length > 0) {
      await SyncEngine.upsertAndCache('teams', teams, `cache:teams:all:${provider.name}`, 86400, 'provider,provider_team_id');
    }
    const players = await provider.syncPlayers();
    if (players.length > 0) {
      await SyncEngine.upsertAndCache('players', players, `cache:players:all:${provider.name}`, 86400, 'provider,provider_player_id');
    }
    if (TransfermarktProvider.isConfigured()) {
      await TransfermarktProvider.syncMarketValues();
    }
    const enrich = await enrichPlayerDetails({
      limit: Number(process.env.ENRICH_PLAYERS_LIMIT || 80),
    });
    if (enrich.updated > 0) {
      console.log(`🧩 Player details enriched: ${enrich.updated}/${enrich.scanned}`);
    }
  });
});

console.log('🟢 Scheduler iniciado (live 30s + pipeline, fixture 1h, daily 02:00)');

registerWorkerStartup().catch(err => {
  console.warn('[Scheduler] startup heartbeat:', err instanceof Error ? err.message : err);
});
