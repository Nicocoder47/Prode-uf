/**
 * Reporte de salud Supabase — npm run audit:supabase-health
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    configured: { url: !!url, serviceRole: !!serviceKey, anonKey: !!anonKey },
    rest: { ok: false, status: 0 },
    auth: { ok: false },
    tables: {} as Record<string, number | string>,
    edgeFunctions: [] as string[],
    rpc: { scoreMatch: 'unknown' as string },
    realtime: { note: 'Verificar en dashboard Supabase → Database → Replication' },
    rls: { note: 'Políticas en supabase/migrations/' },
    errors: [] as string[],
  };

  if (!url || !serviceKey) {
    report.errors.push('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    writeReport(report);
    process.exit(1);
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
      headers: { apikey: anonKey || serviceKey },
    });
    report.rest = { ok: res.ok, status: res.status };
  } catch (e) {
    report.errors.push(`REST unreachable: ${e instanceof Error ? e.message : e}`);
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    report.auth = { ok: !error, error: error?.message };
  } catch (e) {
    report.auth = { ok: false, error: String(e) };
  }

  for (const table of ['matches', 'predictions', 'leaderboard', 'profiles', 'standings', 'events']) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    report.tables[table] = error ? `error: ${error.message}` : (count ?? 0);
  }

  const fnDir = join('supabase', 'functions');
  if (existsSync(fnDir)) {
    report.edgeFunctions = readdirSync(fnDir).filter(n => existsSync(join(fnDir, n, 'index.ts')));
  }

  try {
    const { error } = await supabase.rpc('score_match_predictions', { p_match_id: '00000000-0000-0000-0000-000000000000' });
    report.rpc = {
      scoreMatch: error?.message?.includes('00000000') || error?.code === 'PGRST116' ? 'callable' : error?.message ?? 'ok',
    };
  } catch (e) {
    report.rpc = { scoreMatch: String(e) };
  }

  writeReport(report);
  console.log('Supabase health → reports/supabase-health-report.json');
}

function writeReport(report: Record<string, unknown>) {
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/supabase-health-report.json', JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
