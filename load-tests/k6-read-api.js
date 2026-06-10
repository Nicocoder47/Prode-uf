/**
 * k6 — lectura PostgREST (home, fixture, ranking, jugadores)
 *
 * Uso:
 *   k6 run load-tests/k6-read-api.js
 *   k6 run -e SUPABASE_URL=... -e SUPABASE_ANON_KEY=... load-tests/k6-read-api.js
 *   k6 run --vus 250 --duration 2m load-tests/k6-scenario-250.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE = __ENV.SUPABASE_URL;
const ANON = __ENV.SUPABASE_ANON_KEY;

const matchLatency = new Trend('matches_latency', true);
const lbLatency = new Trend('leaderboard_latency', true);
const playersLatency = new Trend('players_latency', true);
const failRate = new Rate('failed_requests');

export const options = {
  scenarios: {
    read_mix: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.VUS || 50) },
        { duration: '2m', target: Number(__ENV.VUS || 50) },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    failed_requests: ['rate<0.05'],
    matches_latency: ['p(95)<2000'],
    leaderboard_latency: ['p(95)<1500'],
  },
};

const headers = {
  apikey: ANON,
  Authorization: `Bearer ${ANON}`,
};

export default function () {
  if (!BASE || !ANON) {
    throw new Error('Definir SUPABASE_URL y SUPABASE_ANON_KEY');
  }

  const r1 = http.get(
    `${BASE}/rest/v1/matches?select=id,status,kick_off&limit=104`,
    { headers }
  );
  matchLatency.add(r1.timings.duration);
  failRate.add(!check(r1, { 'matches 200': r => r.status === 200 }));

  const r2 = http.get(
    `${BASE}/rest/v1/leaderboard?select=user_id,rank,points&period=eq.global&order=points.desc&limit=100`,
    { headers }
  );
  lbLatency.add(r2.timings.duration);
  failRate.add(!check(r2, { 'leaderboard 200': r => r.status === 200 }));

  const r3 = http.get(
    `${BASE}/rest/v1/players?select=id,name&order=name&limit=200`,
    { headers }
  );
  playersLatency.add(r3.timings.duration);
  failRate.add(!check(r3, { 'players 200': r => r.status === 200 }));

  sleep(0.5 + Math.random() * 0.5);
}
