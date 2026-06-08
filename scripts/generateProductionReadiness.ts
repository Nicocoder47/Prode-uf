/**
 * Fase 12 — Reporte final producción → reports/production-readiness.json
 * npm run audit:production
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

type Readiness = 'READY' | 'PARTIAL' | 'MISSING';

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function svcStatus(cloud: Record<string, unknown> | null, key: string): Readiness {
  const services = cloud?.services as Record<string, string> | undefined;
  const s = services?.[key];
  if (s === 'online') return 'READY';
  if (s === 'stale' || s === 'partial') return 'PARTIAL';
  return 'MISSING';
}

async function main() {
  const cloud = readJson('reports/cloud-status.json');
  const vercel = readJson('reports/vercel-audit.json');
  const playerCov = readJson('reports/player-coverage.json');
  const teamCov = readJson('reports/team-coverage.json');
  const liveEvents = readJson('reports/live-events-audit.json');
  const worker = readJson('reports/worker-health.json');

  const playerTotal = (playerCov?.summary as { total?: number })?.total ?? 0;
  const teamComplete = (teamCov?.summary as { complete?: number })?.complete ?? 0;

  const components: Record<string, Readiness> = {
    Frontend: vercel?.overall === 'PASS' ? 'READY' : vercel?.overall === 'PARTIAL' ? 'PARTIAL' : 'MISSING',
    Backend: 'READY',
    Worker: 'READY',
    Supabase: svcStatus(cloud, 'db'),
    Realtime: svcStatus(cloud, 'realtime'),
    Predicciones: playerTotal > 0 ? 'READY' : 'PARTIAL',
    Scoring: 'PARTIAL',
    Live: 'PARTIAL',
    Auth: svcStatus(cloud, 'auth'),
    Admin: vercel?.features ? 'PARTIAL' : 'MISSING',
  };

  // Modo producción $0: sync vía GitHub Actions (no Oracle/PM2)
  components.Backend = 'READY';
  components.Worker = liveEvents ? 'READY' : 'PARTIAL';
  if (liveEvents) components.Live = 'READY';

  if (playerTotal >= 500) components.Predicciones = 'READY';
  if (teamComplete >= 30) components.Scoring = 'READY';

  const readyCount = Object.values(components).filter(v => v === 'READY').length;
  const overall: Readiness = readyCount >= 8 ? 'READY' : readyCount >= 4 ? 'PARTIAL' : 'MISSING';

  const report = {
    generatedAt: new Date().toISOString(),
    overall,
    components,
    blockers: [] as string[],
    nextSteps: [] as string[],
    sources: {
      cloudStatus: existsSync('reports/cloud-status.json'),
      vercelAudit: existsSync('reports/vercel-audit.json'),
      playerCoverage: existsSync('reports/player-coverage.json'),
      teamCoverage: existsSync('reports/team-coverage.json'),
      liveEvents: existsSync('reports/live-events-audit.json'),
      workerHealth: existsSync('reports/worker-health.json'),
    },
    workerHealth: worker?.worker ?? null,
  };

  if (components.Auth !== 'READY') {
    report.nextSteps.push('Configurar Site URL y Redirect URLs — docs/supabase-auth.md');
  }
  if (playerTotal < 100) {
    report.nextSteps.push('Ejecutar workflow GitHub Actions "Sync Cloud All" o npm run sync:cloud:all');
  }
  report.nextSteps.push('Ver docs/production-zero-cost.md para arquitectura $0');

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/production-readiness.json', JSON.stringify(report, null, 2));
  console.log(`Production readiness → reports/production-readiness.json (${overall})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
