/**
 * Prueba de lectura PostgREST (simula navegación).
 * npm run load:read-api -- --vus=50 --duration=30
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initLoadEnv, summarizeLatencies } from './lib/loadEnv.js';

const args = process.argv.slice(2);
const vus = Number(args.find(a => a.startsWith('--vus='))?.split('=')[1] ?? '50');
const durationSec = Number(args.find(a => a.startsWith('--duration='))?.split('=')[1] ?? '30');

const { url, anonKey } = initLoadEnv();

type Endpoint = { name: string; path: string };

const endpoints: Endpoint[] = [
  { name: 'matches', path: '/rest/v1/matches?select=id,status,kick_off,score_home,score_away&limit=104' },
  { name: 'leaderboard', path: '/rest/v1/leaderboard?select=user_id,rank,points&period=eq.global&order=points.desc&limit=100' },
  { name: 'players_page1', path: '/rest/v1/players?select=id,name,team_id&order=name&limit=200' },
  { name: 'teams', path: '/rest/v1/teams?select=id,name,code&limit=60' },
  { name: 'live_match_stats', path: '/rest/v1/rpc/get_live_match_stats' },
];

async function hit(ep: Endpoint) {
  const started = performance.now();
  const isRpc = ep.path.includes('/rpc/');
  const res = await fetch(`${url}${ep.path}`, {
    method: isRpc ? 'POST' : 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: isRpc ? '{}' : undefined,
  });
  const elapsed = performance.now() - started;
  return { name: ep.name, ok: res.ok, status: res.status, elapsed };
}

async function main() {
  console.log(`\n=== LOAD READ API | VUs=${vus} duration=${durationSec}s ===\n`);
  const endAt = Date.now() + durationSec * 1000;
  const results: Record<string, { ok: number; fail: number; ms: number[]; statuses: Record<number, number> }> = {};

  for (const ep of endpoints) {
    results[ep.name] = { ok: 0, fail: 0, ms: [], statuses: {} };
  }

  async function vuLoop(vuId: number) {
    let i = 0;
    while (Date.now() < endAt) {
      const ep = endpoints[i % endpoints.length];
      try {
        const r = await hit(ep);
        const bucket = results[ep.name];
        if (r.ok) bucket.ok++;
        else bucket.fail++;
        bucket.ms.push(r.elapsed);
        bucket.statuses[r.status] = (bucket.statuses[r.status] ?? 0) + 1;
      } catch {
        results[ep.name].fail++;
      }
      i++;
      await new Promise(r => setTimeout(r, 50 + (vuId % 5) * 20));
    }
  }

  const wallStart = performance.now();
  await Promise.all(Array.from({ length: vus }, (_, i) => vuLoop(i)));
  const wallMs = performance.now() - wallStart;

  const summary: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    vus,
    durationSec,
    wallMs: Math.round(wallMs),
  };

  for (const [name, data] of Object.entries(results)) {
    const total = data.ok + data.fail;
    summary[name] = {
      requests: total,
      ok: data.ok,
      fail: data.fail,
      errorRatePct: total ? Math.round((data.fail / total) * 1000) / 10 : 0,
      latencies: summarizeLatencies(data.ms),
      statuses: data.statuses,
    };
  }

  const p95Values = Object.values(summary)
    .filter((v): v is { latencies: { p95: number } } => typeof v === 'object' && v !== null && 'latencies' in v)
    .map(v => v.latencies.p95);
  const report = { ...summary, p95: Math.max(0, ...p95Values) };

  const dir = join(process.cwd(), 'reports');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'load-read-api.json'), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
