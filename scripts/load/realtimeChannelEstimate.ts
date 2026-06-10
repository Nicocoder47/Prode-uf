/**
 * Estima canales Realtime por ruta (sin abrir conexiones reales).
 * npm run load:realtime-estimate
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCloudEnv } from '../lib/loadCloudEnv.js';

loadCloudEnv();

const betaPolling =
  process.env.VITE_ENABLE_REALTIME !== 'true' ||
  process.env.VITE_BETA_MODE === 'true';

type Route = { name: string; hooks: string[]; channels: number };

const routes: Route[] = [
  { name: 'home (Dashboard)', hooks: betaPolling ? ['polling'] : ['usePredictions', 'useLeaderboard'], channels: betaPolling ? 0 : 2 },
  { name: 'fixture (Matches)', hooks: betaPolling ? ['polling'] : ['usePredictions', 'useLeaderboard'], channels: betaPolling ? 0 : 2 },
  { name: 'leaderboard', hooks: betaPolling ? ['polling'] : ['useLeaderboard'], channels: betaPolling ? 0 : 1 },
  { name: 'predictions', hooks: betaPolling ? ['polling'] : ['usePredictions'], channels: betaPolling ? 0 : 1 },
  { name: 'profile', hooks: betaPolling ? ['polling'] : ['usePredictions', 'useLeaderboard'], channels: betaPolling ? 0 : 2 },
  { name: 'match detail', hooks: betaPolling ? ['polling'] : ['usePredictions', 'useMatchEvents', 'usePlayerLiveStatus'], channels: betaPolling ? 0 : 3 },
  { name: 'players list', hooks: [], channels: 0 },
];

const scenarios = [
  { label: '250 beta', users: 250, mix: { home: 0.35, fixture: 0.15, leaderboard: 0.2, predictions: 0.1, profile: 0.05, matchDetail: 0.1, players: 0.05 } },
  { label: '500 beta', users: 500, mix: { home: 0.35, fixture: 0.15, leaderboard: 0.2, predictions: 0.1, profile: 0.05, matchDetail: 0.1, players: 0.05 } },
  { label: 'pico partido', users: 500, mix: { home: 0.4, fixture: 0.2, leaderboard: 0.25, matchDetail: 0.15, predictions: 0, profile: 0, players: 0 } },
];

function estimateChannels(users: number, mix: Record<string, number>) {
  const byRoute: Record<string, number> = {};
  let total = 0;
  for (const r of routes) {
    const key = r.name.includes('home') ? 'home' : r.name.includes('fixture') ? 'fixture' : r.name.includes('leaderboard') ? 'leaderboard' : r.name.includes('predictions') ? 'predictions' : r.name.includes('profile') ? 'profile' : r.name.includes('match') ? 'matchDetail' : 'players';
    const u = Math.round(users * (mix[key] ?? 0));
    const ch = u * r.channels;
    byRoute[r.name] = ch;
    total += ch;
  }
  return { total, byRoute };
}

console.log(`\n=== Realtime channel estimate (beta_polling=${betaPolling}) ===\n`);

const results: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  betaPolling,
  scenarios: {} as Record<string, unknown>,
};

for (const s of scenarios) {
  const est = estimateChannels(s.users, s.mix);
  results.scenarios[s.label] = est;
  console.log(s.label, JSON.stringify(est, null, 2));
}

results.note = 'Límite Supabase Free ~200 canales; Pro ~500+';

const dir = join(process.cwd(), 'reports');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'load-realtime-estimate.json'), JSON.stringify(results, null, 2));

console.log('\nLímite referencia Supabase Free: ~200 conexiones Realtime concurrentes (verificar en Dashboard → Settings → Billing)');
console.log('Límite Supabase Pro: ~500+ (escalable)\n');
