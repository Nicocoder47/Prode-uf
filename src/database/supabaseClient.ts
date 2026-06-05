import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

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

// Cliente de Supabase para entorno servidor (workers, scripts de sync, scheduler).
// Usa la Service Role Key: NO debe importarse nunca desde el bundle del navegador.
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    '[Supabase] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. ' +
      'El sync no podrá escribir en la base de datos.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', serviceRoleKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});
