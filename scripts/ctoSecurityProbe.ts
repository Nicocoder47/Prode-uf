import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { writeFileSync } from 'node:fs';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } };
const anon = createClient(url, anonKey, opts);
const service = createClient(url, serviceKey, opts);

const results: Record<string, unknown> = {};

async function probe(label: string, fn: () => Promise<unknown>) {
  try {
    results[label] = await fn();
  } catch (e) {
    results[label] = { error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  await probe('anon_profiles_pii', async () => {
    const { data, error, count } = await anon.from('profiles').select('email,dni,legajo,role', { count: 'exact' }).limit(5);
    return { rows: data?.length ?? 0, count, error: error?.message, sample: data?.[0] ?? null };
  });

  await probe('anon_member_reference', async () => {
    const { data, error, count } = await anon.from('member_reference').select('legajo,dni,full_name', { count: 'exact' }).limit(5);
    return { rows: data?.length ?? 0, count, error: error?.message, sample: data?.[0] ?? null };
  });

  await probe('anon_predictions', async () => {
    const { data, error, count } = await anon.from('predictions').select('user_id,match_id,points', { count: 'exact' }).limit(5);
    return { rows: data?.length ?? 0, count, error: error?.message };
  });

  await probe('anon_payments_insert', async () => {
    const { error } = await anon.from('payments').insert({ user_id: '00000000-0000-0000-0000-000000000001', amount: 1, status: 'pending' });
    return { blocked: !!error, error: error?.message, code: error?.code };
  });

  await probe('anon_special_predictions_insert', async () => {
    const { error } = await anon.from('special_predictions').insert({ user_id: '00000000-0000-0000-0000-000000000001', type: 'champion', value: 'ARG' });
    return { blocked: !!error, error: error?.message, code: error?.code };
  });

  await probe('validate_invite_code', async () => {
    const { data, error } = await anon.rpc('validate_invite_code', { p_code: 'PROBE_INVALID' });
    return { data, error: error?.message, code: error?.code };
  });

  await probe('public_leaderboard_profiles_anon', async () => {
    const { data, error, count } = await anon.from('public_leaderboard_profiles').select('id,display_name,legajo', { count: 'exact' }).limit(5);
    return { rows: data?.length ?? 0, count, error: error?.message, hasEmail: data?.some((r: Record<string, unknown>) => 'email' in r) };
  });

  await probe('worker_heartbeat_latest', async () => {
    const { data } = await service.from('system_snapshots').select('created_at,type,payload').eq('type', 'worker_heartbeat').order('created_at', { ascending: false }).limit(3);
    return data;
  });

  await probe('data_sync_logs_latest', async () => {
    const { data } = await service.from('data_sync_logs').select('created_at,task,status,error').order('created_at', { ascending: false }).limit(5);
    return data;
  });

  writeFileSync('reports/cto-security-probe.json', JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main();
