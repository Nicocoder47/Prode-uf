import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

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

const LOCAL_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0:5174/,
  /:5173\b/,
  /:5174\b/,
  /:3001\b/,
  /:54321\b/,
  /:6379\b/,
];

const SCAN_DIRS = ['src', 'server', 'scripts', 'supabase/functions'];
const SCAN_FILES = ['vite.config.ts', 'package.json', '.env.example', 'docker-compose.yml'];
const IGNORE = new Set(['node_modules', 'dist', '.git', 'reports']);

type LocalHit = { file: string; line: number; text: string };

function walk(dir: string, hits: LocalHit[]) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, hits);
    else if (/\.(ts|tsx|js|json|md|yml|yaml|env\.example)$/.test(name)) scanFile(full, hits);
  }
}

function scanFile(file: string, hits: LocalHit[]) {
  const content = readFileSync(file, 'utf8');
  content.split('\n').forEach((line, i) => {
    if (LOCAL_PATTERNS.some(p => p.test(line))) {
      hits.push({ file: relative(process.cwd(), file), line: i + 1, text: line.trim().slice(0, 120) });
    }
  });
}

async function main() {
  const localHits: LocalHit[] = [];
  for (const d of SCAN_DIRS) walk(d, localHits);
  for (const f of SCAN_FILES) {
    if (existsSync(f)) scanFile(f, localHits);
  }

  const devOnlyHits = localHits.filter(
    h =>
      !h.file.includes('vite.config.ts') ||
      !h.text.includes('localhost:3001')
  );

  const requiredFrontend = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;
  const requiredBackend = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
  const optionalCloud = ['REDIS_URL', 'VITE_API_BASE_URL', 'FOOTBALL_DATA_API_KEY', 'API_FOOTBALL_KEY'] as const;

  const envStatus = (keys: readonly string[]) =>
    keys.map(key => ({
      key,
      set: !!process.env[key]?.trim(),
      isLocal: /localhost|127\.0\.0\.1|:54321|:6379/.test(process.env[key] ?? ''),
      valuePreview: process.env[key]?.includes('key') ? '(redacted)' : process.env[key]?.slice(0, 40),
    }));

  let supabaseReachable = false;
  let supabaseStatus = 0;
  const sbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  if (sbUrl) {
    try {
      const res = await fetch(`${sbUrl.replace(/\/$/, '')}/rest/v1/`, {
        headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '' },
      });
      supabaseReachable = res.ok;
      supabaseStatus = res.status;
    } catch {
      supabaseReachable = false;
    }
  }

  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

  const report = {
    generatedAt: new Date().toISOString(),
    objective: 'Deploy gratuito — Vercel + Oracle + Supabase + Upstash',
    architecture: {
      frontend: 'Vercel Free',
      backend: 'Oracle Cloud Always Free',
      database: 'Supabase Free',
      redis: 'Upstash Free (opcional)',
      monitoring: 'UptimeRobot Free',
    },
    package: {
      name: pkg.name,
      buildScript: pkg.scripts?.build ?? null,
      workerScript: pkg.scripts?.worker ?? null,
      apiScript: pkg.scripts?.['api:serve'] ?? null,
    },
    deployArtifacts: {
      vercelJson: existsSync('vercel.json'),
      dockerfile: existsSync('Dockerfile'),
      ecosystemConfig: existsSync('ecosystem.config.js'),
      oracleDocs: existsSync('docs/oracle-deploy.md'),
    },
    environment: {
      frontend: envStatus(requiredFrontend),
      backend: envStatus(requiredBackend),
      optional: envStatus(optionalCloud),
    },
    supabase: {
      url: sbUrl ? sbUrl.replace(/\/\/.*@/, '//***@') : null,
      reachable: supabaseReachable,
      httpStatus: supabaseStatus,
    },
    localReferences: {
      total: localHits.length,
      devOnlyAcceptable: localHits.length - devOnlyHits.length,
      productionRisk: devOnlyHits.filter(h => !h.file.includes('vite.config.ts') && !h.file.includes('.env.example')),
    },
    localHits: localHits.slice(0, 50),
    blockers: [] as string[],
    recommendations: [] as string[],
  };

  if (!report.deployArtifacts.vercelJson) report.blockers.push('Falta vercel.json');
  if (!report.deployArtifacts.dockerfile) report.blockers.push('Falta Dockerfile');
  if (!report.deployArtifacts.ecosystemConfig) report.blockers.push('Falta ecosystem.config.js');

  for (const e of report.environment.frontend) {
    if (!e.set) report.blockers.push(`Variable frontend faltante: ${e.key}`);
    if (e.isLocal) report.recommendations.push(`Reemplazar ${e.key} por URL cloud de Supabase`);
  }

  for (const e of report.environment.backend) {
    if (!e.set) report.blockers.push(`Variable backend faltante: ${e.key}`);
    if (e.isLocal) report.recommendations.push(`Reemplazar ${e.key} por proyecto Supabase cloud`);
  }

  if (!process.env.VITE_API_BASE_URL?.trim()) {
    report.recommendations.push('Configurar VITE_API_BASE_URL con URL pública de Oracle (Express API)');
  }

  if (process.env.REDIS_URL?.includes('127.0.0.1') || process.env.REDIS_URL?.includes('localhost')) {
    report.recommendations.push('Migrar REDIS_URL a Upstash (rediss://...)');
  }

  report.recommendations.push(
    'Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL',
    'Oracle: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_API_KEY, REDIS_URL (Upstash)',
    'Monitoreo UptimeRobot: GET /api/health y frontend Vercel URL'
  );

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/deploy-audit.json', JSON.stringify(report, null, 2));

  console.log('Deploy audit generado → reports/deploy-audit.json');
  console.log(`Referencias locales: ${report.localReferences.total}`);
  console.log(`Blockers: ${report.blockers.length}`);
  console.log(`Supabase reachable: ${report.supabase.reachable}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
