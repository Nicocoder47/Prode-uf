/**
 * Fase 1 — Auditoría cloud → reports/cloud-status.json
 * npm run audit:cloud
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { CLOUD_DEFAULTS, loadCloudEnv } from './lib/loadCloudEnv.js';

type ServiceStatus = 'online' | 'offline' | 'stale' | 'unknown' | 'partial';

loadCloudEnv();

async function fetchStatus(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    return { ok: res.ok, status: res.status, reachable: true };
  } catch (e) {
    return { ok: false, status: 0, reachable: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function workerStatus(lastAt: string | null): ServiceStatus {
  if (!lastAt) return 'unknown';
  const ageSec = (Date.now() - new Date(lastAt).getTime()) / 1000;
  if (ageSec <= 90) return 'online';
  if (ageSec <= 300) return 'stale';
  return 'offline';
}

async function main() {
  const vercelUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : CLOUD_DEFAULTS.vercelUrl;
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || CLOUD_DEFAULTS.supabaseUrl).replace(/\/$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const apiBase = process.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

  const [frontend, backend, restProbe, realtime] = await Promise.all([
    fetchStatus(vercelUrl),
    apiBase ? fetchStatus(`${apiBase}/api/health`) : Promise.resolve({ ok: false, status: 0, reachable: false, error: 'VITE_API_BASE_URL not set' }),
    fetchStatus(`${supabaseUrl}/rest/v1/teams?select=id&limit=1`, {
      headers: {
        apikey: serviceKey || anonKey,
        Authorization: `Bearer ${serviceKey || anonKey}`,
      },
    }),
    fetchStatus(`${supabaseUrl}/realtime/v1/`, {
      headers: { apikey: anonKey || serviceKey },
    }),
  ]);

  let auth: ServiceStatus = 'unknown';
  let authDetail: string | undefined;
  if (serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    auth = error ? 'offline' : 'online';
    authDetail = error?.message;
  } else {
    auth = 'unknown';
    authDetail = 'SUPABASE_SERVICE_ROLE_KEY missing';
  }

  let worker: ServiceStatus = 'unknown';
  let lastHeartbeat: string | null = null;
  if (serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data } = await supabase
      .from('system_snapshots')
      .select('created_at')
      .eq('snapshot_type', 'worker_heartbeat')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    lastHeartbeat = data?.created_at ?? null;
    worker = workerStatus(lastHeartbeat);
  }

  const services = {
    frontend: frontend.ok ? 'online' : frontend.reachable ? 'partial' : 'offline',
    backend: backend.ok ? 'online' : apiBase ? 'offline' : 'unknown',
    worker,
    db: restProbe.ok ? 'online' : restProbe.reachable ? 'partial' : 'offline',
    auth,
    realtime: realtime.reachable ? 'online' : 'offline',
  } satisfies Record<string, ServiceStatus>;

  const onlineCount = Object.values(services).filter(s => s === 'online').length;
  const overall =
    onlineCount >= 5 ? 'READY' : onlineCount >= 3 ? 'PARTIAL' : 'MISSING';

  const report = {
    generatedAt: new Date().toISOString(),
    overall,
    services,
    details: {
      frontend: { url: vercelUrl, httpStatus: frontend.status, reachable: frontend.reachable },
      backend: {
        url: apiBase ? `${apiBase}/api/health` : null,
        httpStatus: backend.status,
        reachable: backend.reachable,
        note: apiBase ? undefined : 'Oracle no desplegado — configurar VITE_API_BASE_URL',
      },
      worker: { lastHeartbeatAt: lastHeartbeat, expectedIntervalSec: 60 },
      db: { url: supabaseUrl, httpStatus: restProbe.status, probe: 'teams?select=id&limit=1' },
      auth: { detail: authDetail },
      realtime: { httpStatus: realtime.status, note: 'Endpoint /realtime/v1/ responde si Realtime está habilitado' },
    },
    infrastructure: {
      github: { repo: CLOUD_DEFAULTS.githubRepo, connected: true },
      vercel: { project: 'prodemundialprode', url: vercelUrl },
      supabase: { projectRef: CLOUD_DEFAULTS.supabaseProjectRef, url: supabaseUrl },
      oracle: { deployed: backend.ok, apiUrl: apiBase || null },
    },
    environment: {
      envCloudFile: existsSync('.env.cloud'),
      viteSupabaseUrl: !!process.env.VITE_SUPABASE_URL?.trim(),
      viteSupabaseAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY?.trim(),
      supabaseServiceRole: !!serviceKey,
      footballDataApiKey: !!process.env.FOOTBALL_DATA_API_KEY?.trim(),
      corsOrigin: process.env.CORS_ORIGIN ?? null,
    },
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/cloud-status.json', JSON.stringify(report, null, 2));
  console.log('Cloud status → reports/cloud-status.json');
  console.log(JSON.stringify(services, null, 2));
  console.log(`Overall: ${overall}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
