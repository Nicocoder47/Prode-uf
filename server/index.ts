import express from 'express';
import cors from 'cors';
import { readFileSync, existsSync } from 'node:fs';
import footballRoutes from './routes/football.routes.js';
import adminRoutes from './routes/admin.routes.js';

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

loadEnvFile('.env.cloud');
loadEnvFile('.env');
loadEnvFile('.env.local');

const app = express();
const port = Number(process.env.API_PORT || process.env.PORT || 3001);
const host = process.env.API_HOST || '0.0.0.0';
const corsOrigin = process.env.CORS_ORIGIN?.trim();

app.use(
  cors({
    origin: corsOrigin || true,
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  const checks: Record<string, { ok: boolean; detail?: string }> = {
    process: { ok: true, detail: `pid ${process.pid}` },
    supabase: { ok: false },
    redis: { ok: false, detail: 'optional' },
  };

  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sbUrl && sbKey) {
    try {
      const r = await fetch(`${sbUrl.replace(/\/$/, '')}/rest/v1/`, {
        headers: { apikey: sbKey },
      });
      checks.supabase = { ok: r.ok, detail: `HTTP ${r.status}` };
    } catch (e) {
      checks.supabase = { ok: false, detail: e instanceof Error ? e.message : 'unreachable' };
    }
  } else {
    checks.supabase = { ok: false, detail: 'SUPABASE_SERVICE_ROLE_KEY missing (never use anon key on API)' };
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    checks.redis = { ok: true, detail: 'not configured (Supabase-only mode)' };
  } else {
    try {
      const { default: Redis } = await import('ioredis');
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
        connectTimeout: 3000,
        ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
      });
      await client.connect();
      await client.ping();
      await client.quit();
      checks.redis = { ok: true, detail: 'ping ok' };
    } catch (e) {
      checks.redis = { ok: false, detail: e instanceof Error ? e.message : 'ping failed' };
    }
  }

  const ok = checks.process.ok && checks.supabase.ok && (checks.redis.ok || !redisUrl);
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'error',
    ok,
    service: 'prodemundial-api',
    version: process.env.npm_package_version ?? '0.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    timestamp: new Date().toISOString(),
    checks,
  });
});

app.use('/api', footballRoutes);
app.use('/api/admin', adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(port, host, () => {
  console.log(`🟢 PRODEMUNDIAL API listening on ${host}:${port}/api`);
});
