/**
 * Prueba de carga: N usuarios predicen el MISMO partido concurrentemente.
 * npm run load:save-prediction -- --users=50
 * npm run load:save-prediction -- --users=100 --match-id=<uuid>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { initLoadEnv, summarizeLatencies } from './lib/loadEnv.js';

const args = process.argv.slice(2);
const usersArg = Number(args.find(a => a.startsWith('--users='))?.split('=')[1] ?? '50');
const matchIdArg = args.find(a => a.startsWith('--match-id='))?.split('=')[1];
const concurrencyArg = Number(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] ?? usersArg);
const cleanup = !args.includes('--no-cleanup');

const { url, anonKey, serviceKey } = initLoadEnv();
const opts = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
};

const admin = createClient(url, serviceKey, opts);

type Session = { userId: string; email: string; token: string };

async function findScheduledMatch(): Promise<string> {
  const { data, error } = await admin
    .from('matches')
    .select('id,kick_off,status')
    .eq('status', 'scheduled')
    .gt('kick_off', new Date(Date.now() + 3600_000).toISOString())
    .order('kick_off', { ascending: true })
    .limit(1);
  if (error) throw error;
  if (!data?.[0]?.id) throw new Error('No hay partido scheduled futuro para prueba');
  return data[0].id as string;
}

async function createUser(i: number): Promise<Session> {
  const email = `load-${Date.now()}-${i}@loadtest.prodemundial.test`;
  const password = `LoadTest!${i}${Date.now()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');

  await admin.from('profiles').upsert({
    id: data.user.id,
    full_name: `Load User ${i}`,
    is_active: true,
    role: 'user',
  });

  const client = createClient(url, anonKey, opts);
  const { data: signIn, error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr || !signIn.session) throw signErr ?? new Error('signIn failed');

  return { userId: data.user.id, email, token: signIn.session.access_token };
}

async function savePrediction(token: string, matchId: string, home: number, away: number) {
  const started = performance.now();
  const res = await fetch(`${url}/rest/v1/rpc/save_prediction`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_match_id: matchId,
      p_score_home: home,
      p_score_away: away,
    }),
  });
  const elapsed = performance.now() - started;
  const body = await res.text();
  return { ok: res.ok, status: res.status, elapsed, body };
}

async function runPool<T>(items: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await items[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function main() {
  const users = Math.max(1, Math.min(usersArg, 500));
  const concurrency = Math.max(1, Math.min(concurrencyArg, users));
  const matchId = matchIdArg ?? (await findScheduledMatch());

  console.log('\n=== LOAD: save_prediction (mismo partido) ===');
  console.log(`match_id: ${matchId}`);
  console.log(`users: ${users} | concurrency: ${concurrency}\n`);

  const sessions: Session[] = [];
  for (let i = 0; i < users; i++) {
    try {
      sessions.push(await createUser(i));
    } catch (e) {
      console.error(`Fallo crear usuario ${i}:`, e);
    }
  }
  console.log(`Usuarios creados: ${sessions.length}/${users}`);

  const tasks = sessions.map((s, i) => async () => {
    const home = 1 + (i % 3);
    const away = i % 2;
    try {
      return await savePrediction(s.token, matchId, home, away);
    } catch (e) {
      return { ok: false, status: 0, elapsed: 0, body: String(e) };
    }
  });

  const wallStart = performance.now();
  const results = await runPool(tasks, concurrency);
  const wallMs = performance.now() - wallStart;

  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  const latencies = summarizeLatencies(results.map(r => r.elapsed));

  const { count } = await admin
    .from('predictions')
    .select('*', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .in('user_id', sessions.map(s => s.userId));

  const dupCheck = await admin
    .from('predictions')
    .select('user_id')
    .eq('match_id', matchId)
    .in('user_id', sessions.map(s => s.userId));

  const userIds = (dupCheck.data ?? []).map(r => r.user_id as string);
  const uniqueUsers = new Set(userIds).size;
  const duplicates = userIds.length - uniqueUsers;

  const report = {
    generatedAt: new Date().toISOString(),
    matchId,
    usersRequested: users,
    usersCreated: sessions.length,
    concurrency,
    wallMs: Math.round(wallMs),
    rps: Math.round((results.length / wallMs) * 1000 * 10) / 10,
    success: ok.length,
    failed: fail.length,
    latencies,
    predictionsInDb: count ?? 0,
    uniqueUsersWithPrediction: uniqueUsers,
    duplicateRows: duplicates,
    sampleErrors: fail.slice(0, 5).map(f => ({ status: f.status, body: f.body.slice(0, 200) })),
  };

  const fileReport = { ...report, p95: latencies.p95 };
  const dir = join(process.cwd(), 'reports');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'load-save-prediction.json'), JSON.stringify(fileReport, null, 2));

  console.log(JSON.stringify(fileReport, null, 2));

  if (cleanup) {
    for (const s of sessions) {
      await admin.from('predictions').delete().eq('user_id', s.userId);
      await admin.auth.admin.deleteUser(s.userId);
    }
    console.log('\nCleanup: usuarios y predicciones de prueba eliminados');
  } else {
    console.log('\n--no-cleanup: datos de prueba conservados');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
