/**
 * Worker health — npm run audit:worker-health → reports/worker-health.json
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

function workerStatus(lastAt: string | null): string {
  if (!lastAt) return 'unknown';
  const ageSec = (Date.now() - new Date(lastAt).getTime()) / 1000;
  if (ageSec <= 90) return 'online';
  if (ageSec <= 300) return 'stale';
  return 'offline';
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const report = {
    generatedAt: new Date().toISOString(),
    host: process.env.WORKER_HOST || process.env.HOSTNAME || 'unknown',
    nodeEnv: process.env.NODE_ENV || 'development',
    scheduler: {
      script: 'src/workers/scheduler.ts',
      liveIntervalSec: 30,
      fixtureCron: '0 * * * *',
      dailyCron: '0 2 * * *',
      tasks: ['live sync', 'fixtures', 'standings', 'knockout', 'teams/players enrich'],
    },
    worker: {
      status: 'unknown' as string,
      lastHeartbeatAt: null as string | null,
      lastCycle: null as Record<string, unknown> | null,
    },
    sync: {
      lastLiveMatches: null as { at: string; status: string } | null,
      lastLivePipeline: null as { at: string; status: string } | null,
    },
    redis: {
      configured: !!process.env.REDIS_URL?.trim(),
      optional: true,
      provider: process.env.REDIS_URL?.includes('upstash') ? 'upstash' : 'other',
    },
    errors: [] as string[],
  };

  if (!url || !key) {
    report.errors.push('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    writeReport(report);
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: hb } = await supabase
    .from('system_snapshots')
    .select('created_at,payload')
    .eq('snapshot_type', 'worker_heartbeat')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  report.worker.lastHeartbeatAt = hb?.created_at ?? null;
  report.worker.lastCycle = (hb?.payload as Record<string, unknown>) ?? null;
  report.worker.status = workerStatus(report.worker.lastHeartbeatAt);

  for (const syncType of ['live_matches', 'live_pipeline'] as const) {
    const { data } = await supabase
      .from('data_sync_logs')
      .select('finished_at,status')
      .eq('sync_type', syncType)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      report.sync[syncType === 'live_matches' ? 'lastLiveMatches' : 'lastLivePipeline'] = {
        at: data.finished_at ?? '',
        status: data.status,
      };
    }
  }

  writeReport(report);
  console.log(`Worker: ${report.worker.status} → reports/worker-health.json`);
}

function writeReport(report: unknown) {
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/worker-health.json', JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
