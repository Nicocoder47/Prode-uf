/**
 * Worker LIVE — ciclo completo cada 30s (partidos + events + ratings + MVP).
 */
import { runLiveSyncCycle } from '../services/sync/liveWorkerService';
import { SyncEngine } from '../services/sync/SyncEngine';

const INTERVAL_MS = 30_000;

async function tick() {
  const result = await SyncEngine.runWithRetry('Live Sync Cycle', () => runLiveSyncCycle());
  if (result) {
    console.log(
      `[LiveWorker] matches=${result.liveMatchesUpserted} bundles=${result.liveBundlesProcessed} ${result.ok ? 'OK' : 'WARN'}`
    );
  }
}

console.log('🟢 Worker LIVE iniciado (intervalo 30s, pipeline API-Football si configurado)');
tick();
setInterval(tick, INTERVAL_MS);
