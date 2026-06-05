/**
 * Health check for PRODEMUNDIAL local stack.
 */
import { readFileSync, existsSync } from 'node:fs';

const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

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
  console.log('PRODEMUNDIAL Health Check\n');
  let ok = true;

  for (const key of required) {
    const val = process.env[key];
    if (!val || val.includes('your-')) {
      console.log(`FAIL ${key}`);
      ok = false;
    } else {
      console.log(`OK   ${key}`);
    }
  }

  const url = process.env.VITE_SUPABASE_URL;
  if (url) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
        headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY || '' },
      });
      console.log(res.ok ? 'OK   Supabase REST' : `WARN Supabase HTTP ${res.status}`);
    } catch {
      console.log('WARN Supabase unreachable');
    }
  }

  process.exit(ok ? 0 : 1);
}

main();