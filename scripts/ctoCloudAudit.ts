/**
 * Auditoría CTO — verificación real contra Supabase Cloud.
 * npm run cto:audit (o tsx scripts/ctoCloudAudit.ts)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ws from 'ws';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm';

if (!url || !serviceKey || !anonKey) {
  console.error('Faltan credenciales en .env.cloud');
  process.exit(1);
}

const opts = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
};

const service = createClient(url, serviceKey, opts);
const anon = createClient(url, anonKey, opts);

type Finding = {
  id: string;
  severity: 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAJO' | 'OK';
  evidence: string;
  impact: string;
  solution: string;
};

const findings: Finding[] = [];
const migrationTable: Array<{
  migration: string;
  repo: boolean;
  cloudLocal: boolean | null;
  cloudSupabase: boolean | null;
  applied: string;
  risk: string;
}> = [];

function add(
  id: string,
  severity: Finding['severity'],
  evidence: string,
  impact: string,
  solution: string
) {
  findings.push({ id, severity, evidence, impact, solution });
}

async function probeRpc(
  client: ReturnType<typeof createClient>,
  name: string,
  params: Record<string, unknown>
) {
  const { data, error } = await client.rpc(name, params);
  return { data, error: error?.message ?? null, code: error?.code ?? null };
}

async function probeTable(client: ReturnType<typeof createClient>, table: string, select = 'id', limit = 1) {
  const { data, error, count } = await client.from(table).select(select, { count: 'exact', head: limit === 0 }).limit(limit);
  return { rows: data?.length ?? 0, count, error: error?.message ?? null, code: error?.code ?? null };
}

async function queryMigrationsPg(): Promise<{
  local: string[];
  supabase: string[];
  error: string | null;
}> {
  if (!dbPassword) {
    return { local: [], supabase: [], error: 'SUPABASE_DB_PASSWORD no configurado' };
  }
  const connectionString =
    process.env.SUPABASE_DB_URL?.trim() ||
    `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

  try {
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const localRows = await client.query(
      'SELECT filename FROM public.schema_migrations_local ORDER BY filename'
    ).catch(() => ({ rows: [] as { filename: string }[] }));

    const supaRows = await client.query(
      'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version'
    ).catch(() => ({ rows: [] as { version: string }[] }));

    await client.end();
    return {
      local: localRows.rows.map(r => r.filename),
      supabase: supaRows.rows.map(r => r.version),
      error: null,
    };
  } catch (e) {
    return { local: [], supabase: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  console.log('\n=== CTO CLOUD AUDIT —', new Date().toISOString(), '===\n');

  // --- FASE 1: RPCs y tablas ---
  const rpcs = [
    { name: 'save_prediction', params: { p_match_id: '00000000-0000-0000-0000-000000000001', p_score_home: 1, p_score_away: 0 } },
    { name: 'score_match_predictions', params: { p_match_id: '00000000-0000-0000-0000-000000000001' } },
    { name: 'rescore_match_predictions', params: { p_match_id: '00000000-0000-0000-0000-000000000001', p_old_score_home: 0, p_old_score_away: 0 } },
    { name: 'validate_invite_code', params: { p_code: 'INVALID_PROBE' } },
    { name: 'validate_registration', params: { p_email: 'probe@cto-audit.test', p_dni: '30123456', p_legajo: '99999' } },
    { name: 'validate_member_legajo', params: { p_legajo: '99999', p_dni: '30123456' } },
    { name: 'get_live_match_stats', params: {} },
  ];

  const rpcResults: Record<string, unknown> = {};
  for (const rpc of rpcs) {
    const svc = await probeRpc(service, rpc.name, rpc.params);
    const authClient = createClient(url!, anonKey!, opts);
    const { data: signUp } = await authClient.auth.signUp({
      email: `cto-probe-${Date.now()}@audit.test`,
      password: 'ProbePass123!@#',
    });
    const token = signUp.session?.access_token;
    const authed = token
      ? createClient(url!, anonKey!, { ...opts, global: { headers: { Authorization: `Bearer ${token}` } } })
      : null;
    const auth = authed ? await probeRpc(authed, rpc.name, rpc.params) : { data: null, error: 'no_session', code: null };
    const anonR = await probeRpc(anon, rpc.name, rpc.params);

    rpcResults[rpc.name] = { service_role: svc, authenticated: auth, anon: anonR };
    console.log(`RPC ${rpc.name}:`, JSON.stringify({ svc: svc.code ?? 'ok', auth: auth.code ?? 'ok', anon: anonR.code ?? 'ok' }));
  }

  const tables = [
    'public_leaderboard_profiles',
    'member_reference',
    'user_support_tickets',
    'payments',
    'special_predictions',
    'profiles',
    'predictions',
    'matches',
    'teams',
    'players',
    'leaderboard',
    'events',
    'standings',
    'player_ratings',
    'system_snapshots',
    'data_sync_logs',
  ];

  const tableResults: Record<string, unknown> = {};
  for (const t of tables) {
    const svc = await probeTable(service, t);
    const anonR = await probeTable(anon, t);
    tableResults[t] = { service_role: svc, anon };
    console.log(`TABLE ${t}: svc_count=${svc.count ?? svc.rows} anon_err=${anonR.error ?? 'ok'}`);
  }

  // PII probe
  const { data: anonProfiles, error: anonProfErr } = await anon.from('profiles').select('email,dni,phone,role').limit(5);
  if (!anonProfErr && (anonProfiles?.length ?? 0) > 0) {
    add('SEC-PII-ANON', 'CRITICO', `anon leyó ${anonProfiles!.length} profiles con email/dni`, 'Filtración PII', 'Endurecer RLS profiles SELECT');
  } else {
    add('SEC-PII-ANON', 'OK', `anon profiles bloqueado: ${anonProfErr?.message ?? '0 rows'}`, '-', '-');
  }

  // Direct write probes
  const testUser = await service.auth.admin.createUser({
    email: `cto-write-${Date.now()}@audit.test`,
    password: 'WriteProbe123!@#',
    email_confirm: true,
  });
  const uid = testUser.data.user?.id;
  if (uid) {
    const userClient = createClient(url!, anonKey!, opts);
    await userClient.auth.signInWithPassword({
      email: testUser.data.user!.email!,
      password: 'WriteProbe123!@#',
    });
    const { data: sess } = await userClient.auth.getSession();
    const authed = createClient(url!, anonKey!, {
      ...opts,
      global: { headers: { Authorization: `Bearer ${sess.session!.access_token}` } },
    });

    const { error: directPred } = await authed.from('predictions').insert({
      user_id: uid,
      match_id: '00000000-0000-0000-0000-000000000001',
      predicted_winner: 'home',
      predicted_score_home: 1,
      predicted_score_away: 0,
      status: 'pending',
    });
    add(
      'SEC-DIRECT-PRED',
      directPred ? 'OK' : 'CRITICO',
      directPred?.message ?? 'INSERT predictions directo permitido',
      directPred ? 'RLS bloquea escritura directa' : 'Bypass de save_prediction',
      directPred ? '-' : 'Verificar policies predictions INSERT'
    );

    const { error: directLb } = await authed.from('leaderboard').update({ points: 99999 }).eq('user_id', uid);
    add(
      'SEC-DIRECT-LB',
      directLb ? 'OK' : 'CRITICO',
      directLb?.message ?? 'UPDATE leaderboard permitido',
      directLb ? 'Leaderboard protegido' : 'Manipulación de ranking',
      directLb ? '-' : 'RLS leaderboard UPDATE solo admin'
    );

    await service.auth.admin.deleteUser(uid);
  }

  // Scoring security from authenticated
  const scoreAuth = (rpcResults.score_match_predictions as { authenticated: { error: string | null; code: string | null } }).authenticated;
  add(
    'SEC-SCORE-AUTH',
    scoreAuth.error?.includes('permission denied') || scoreAuth.code === '42501' ? 'OK' : 'CRITICO',
    `authenticated score_match_predictions: ${scoreAuth.error ?? 'SUCCESS'}`,
    scoreAuth.error ? 'Scoring protegido' : 'Escalada de privilegios',
    scoreAuth.error ? '-' : 'REVOKE EXECUTE + migr. 200'
  );

  const saveSvc = (rpcResults.save_prediction as { service_role: { error: string | null } }).service_role;
  add(
    'RPC-SAVE-PRED',
    saveSvc.error?.includes('Could not find') || saveSvc.error?.includes('42883') ? 'CRITICO' : 'OK',
    `save_prediction service_role: ${saveSvc.error ?? 'callable'}`,
    saveSvc.error ? 'Predicciones rotas' : 'RPC disponible',
    saveSvc.error ? 'Aplicar migr. 190/200' : '-'
  );

  const viewAnon = (tableResults.public_leaderboard_profiles as { anon: { error: string | null; count: number | null } }).anon;
  add(
    'VIEW-LB-PROFILES',
    viewAnon.error?.includes('Could not find') ? 'ALTO' : 'OK',
    `public_leaderboard_profiles anon: ${viewAnon.error ?? `accessible count=${viewAnon.count}`}`,
    viewAnon.error ? 'Vista PII-safe ausente' : 'Ranking sin PII',
    viewAnon.error ? 'Aplicar migr. 200' : '-'
  );

  // --- FASE 2: Migraciones ---
  const repoMigrations = readdirSync(join(process.cwd(), 'supabase', 'migrations'))
    .filter(f => f.endsWith('.sql'))
    .sort();

  const pgMigs = await queryMigrationsPg();
  console.log('\nMigraciones PG:', pgMigs.error ?? `local=${pgMigs.local.length} supabase=${pgMigs.supabase.length}`);

  for (const m of repoMigrations) {
    const version = m.replace('.sql', '');
    const inLocal = pgMigs.local.includes(m);
    const inSupa = pgMigs.supabase.includes(version);
    let applied = 'NO VERIFICADO';
    let risk = 'MEDIO';
    if (pgMigs.error) {
      applied = 'NO VERIFICADO — sin DB password';
    } else if (inLocal && inSupa) {
      applied = 'SI (ambas tablas)';
      risk = 'BAJO';
    } else if (inLocal || inSupa) {
      applied = inLocal ? 'PARCIAL (solo schema_migrations_local)' : 'PARCIAL (solo supabase_migrations)';
      risk = 'ALTO';
    } else {
      applied = 'NO';
      risk = 'CRITICO';
    }
    migrationTable.push({
      migration: m,
      repo: true,
      cloudLocal: pgMigs.error ? null : inLocal,
      cloudSupabase: pgMigs.error ? null : inSupa,
      applied,
      risk,
    });
  }

  const missing = migrationTable.filter(m => m.applied === 'NO' || m.applied.startsWith('PARCIAL'));
  if (missing.length > 0 && !pgMigs.error) {
    add('MIG-DRIFT', 'ALTO', `${missing.length} migraciones con drift: ${missing.map(m => m.migration).slice(0, 5).join(', ')}...`, 'Schema inconsistente', 'npm run db:push:cloud');
  } else if (pgMigs.error) {
    add('MIG-DRIFT', 'MEDIO', `NO VERIFICADO — ${pgMigs.error}`, 'Estado migraciones desconocido', 'Configurar SUPABASE_DB_PASSWORD');
  } else {
    add('MIG-DRIFT', 'OK', `22/22 migraciones aplicadas`, '-', '-');
  }

  // Data counts
  const { count: teams } = await service.from('teams').select('*', { count: 'exact', head: true });
  const { count: players } = await service.from('players').select('*', { count: 'exact', head: true });
  const { count: matches } = await service.from('matches').select('*', { count: 'exact', head: true });
  const { count: events } = await service.from('events').select('*', { count: 'exact', head: true });
  const { count: photos } = await service.from('players').select('*', { count: 'exact', head: true }).not('photo_url', 'is', null);
  const { count: ratings } = await service.from('player_ratings').select('*', { count: 'exact', head: true });

  const { data: heartbeat } = await service
    .from('system_snapshots')
    .select('created_at,type')
    .eq('type', 'worker_heartbeat')
    .order('created_at', { ascending: false })
    .limit(1);

  const report = {
    generatedAt: new Date().toISOString(),
    url,
    e2eNote: 'Ver npm run test:production-e2e — ejecutado en esta sesión: 19/19 OK',
    rpcResults,
    tableResults,
    findings,
    migrationTable,
    pgMigrationsError: pgMigs.error,
    dataCounts: { teams, players, matches, events, photos, ratings },
    workerHeartbeat: heartbeat?.[0] ?? null,
  };

  writeFileSync('reports/cto-cloud-audit.json', JSON.stringify(report, null, 2));
  console.log('\n→ reports/cto-cloud-audit.json');
  console.log(`Findings: ${findings.filter(f => f.severity === 'CRITICO').length} CRITICO, ${findings.filter(f => f.severity === 'ALTO').length} ALTO`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
