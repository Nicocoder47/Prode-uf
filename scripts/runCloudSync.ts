/**
 * Fase 7 — Sync datos reales contra Supabase cloud
 * npm run sync:cloud:all
 */
import { spawnSync } from 'node:child_process';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

const STEPS: Array<{ script: string; args?: string[]; env?: Record<string, string>; optional?: boolean }> = [
  { script: 'sync:teams' },
  { script: 'sync:players' },
  { script: 'sync:fixtures' },
  { script: 'sync:standings' },
  {
    script: 'sync:players:enrich',
    args: [String(process.env.ENRICH_PLAYERS_LIMIT || 15)],
    optional: process.env.SKIP_PLAYER_ENRICH === '1',
    env: {
      PLAYER_ENRICH_FAST: '1',
      PLAYER_ENRICH_DELAY_MS: '0',
    },
  },
  { script: 'sync:teams:enrich' },
];

function runStep(script: string, args: string[] = [], extraEnv: Record<string, string> = {}, optional = false) {
  if (optional) {
    console.log(`\n⏭ Omitiendo ${script} (SKIP_PLAYER_ENRICH=1)\n`);
    return;
  }
  const npmArgs = ['run', script, ...(args.length ? ['--', ...args] : [])];
  console.log(`\n▶ npm ${npmArgs.join(' ')}\n`);
  const result = spawnSync('npm', npmArgs, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    console.error(`FAIL: ${script} (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

async function main() {
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error('Configurar .env.cloud con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (/localhost|127\.0\.0\.1|:54321/.test(process.env.SUPABASE_URL)) {
    console.error('SUPABASE_URL apunta a local — usar cloud en .env.cloud');
    process.exit(1);
  }

  console.log(`Sync cloud → ${process.env.SUPABASE_URL}`);
  for (const step of STEPS) runStep(step.script, step.args ?? [], step.env ?? {}, step.optional);
  console.log('\n✓ Sync cloud completado');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
