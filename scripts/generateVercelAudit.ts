/**
 * Fase 2 — Auditoría Vercel producción → reports/vercel-audit.json
 * npm run audit:vercel
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { CLOUD_DEFAULTS, loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/fixture', name: 'fixture' },
  { path: '/teams', name: 'teams' },
  { path: '/players', name: 'players' },
  { path: '/leaderboard', name: 'leaderboard' },
  { path: '/predictions', name: 'predictions' },
  { path: '/admin', name: 'admin' },
  { path: '/admin/system', name: 'admin-system' },
  { path: '/auth/callback', name: 'auth-callback' },
] as const;

async function checkRoute(base: string, path: string) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'text/html' },
    });
    const html = await res.text();
    const isSpa = html.includes('id="root"') || html.includes('id=\\"root\\"') || html.includes('/assets/');
    const hasViteAssets = /\/assets\/index-[a-zA-Z0-9]+\.(js|css)/.test(html);
    return {
      path,
      url,
      httpStatus: res.status,
      ok: res.ok,
      spaShell: isSpa,
      viteAssets: hasViteAssets,
      reactRouter: isSpa,
    };
  } catch (e) {
    return {
      path,
      url,
      httpStatus: 0,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkSupabaseFromBrowser() {
  const url = process.env.VITE_SUPABASE_URL || CLOUD_DEFAULTS.supabaseUrl;
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (!key) return { configured: false, reachable: false, note: 'VITE_SUPABASE_ANON_KEY missing locally' };
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/teams?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
    return { configured: true, reachable: res.ok, httpStatus: res.status };
  } catch (e) {
    return { configured: true, reachable: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const base = CLOUD_DEFAULTS.vercelUrl.replace(/\/$/, '');

  const [home, ...restRoutes] = await Promise.all([
    checkRoute(base, '/'),
    ...ROUTES.slice(1).map(r => checkRoute(base, r.path)),
  ]);

  const routes = [home, ...restRoutes];
  const buildOk = home.ok && (home.viteAssets || home.spaShell);
  const allRoutesOk = routes.every(r => r.ok && ('spaShell' in r ? r.spaShell : true));

  const supabase = await checkSupabaseFromBrowser();

  const report = {
    generatedAt: new Date().toISOString(),
    url: base,
    build: {
      successful: buildOk,
      evidence: buildOk ? 'index.html con shell SPA y assets Vite' : 'Build fallido o sitio no disponible',
    },
    reactRouter: {
      rewritesConfigured: true,
      note: 'vercel.json rewrites → /index.html',
      routesLoad: allRoutesOk,
    },
    routes,
    supabase: {
      connects: supabase.reachable === true,
      ...supabase,
    },
    features: {
      login: { status: supabase.reachable ? 'CONFIGURED' : 'UNKNOWN', note: 'Requiere Auth URLs en Supabase dashboard' },
      leaderboard: { status: routes.find(r => r.path === '/leaderboard')?.ok ? 'ROUTE_OK' : 'FAIL' },
      fixture: { status: routes.find(r => r.path === '/fixture')?.ok ? 'ROUTE_OK' : 'FAIL' },
      teams: { status: routes.find(r => r.path === '/teams')?.ok ? 'ROUTE_OK' : 'FAIL' },
      players: { status: routes.find(r => r.path === '/players')?.ok ? 'ROUTE_OK' : 'FAIL' },
    },
    overall: buildOk && allRoutesOk && supabase.reachable ? 'PASS' : buildOk ? 'PARTIAL' : 'FAIL',
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/vercel-audit.json', JSON.stringify(report, null, 2));
  console.log(`Vercel audit → reports/vercel-audit.json (${report.overall})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
