import { readFileSync, existsSync } from 'node:fs';

export const CLOUD_DEFAULTS = {
  vercelUrl: 'https://prodemundialprode.vercel.app',
  supabaseUrl: 'https://irklqwsnehlfcgehvscm.supabase.co',
  supabaseProjectRef: 'irklqwsnehlfcgehvscm',
  githubRepo: 'https://github.com/Nicocoder47/Prode-uf',
} as const;

export function loadEnvFile(path: string) {
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

/** Prioriza .env.cloud para auditorías y sync contra Supabase cloud. */
export function loadCloudEnv() {
  loadEnvFile('.env.cloud');
  loadEnvFile('.env.local');
  loadEnvFile('.env');
}
