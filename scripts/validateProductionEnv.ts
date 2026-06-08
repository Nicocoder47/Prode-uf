/**
 * Valida variables críticas para producción $0 (Vercel + Supabase + GitHub Actions).
 * Uso: npm run validate:production-env
 */
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

const errors: string[] = [];
const warnings: string[] = [];

function req(name: string, label?: string) {
  if (!process.env[name]?.trim()) errors.push(`Falta ${label ?? name}`);
}

// Sync (GitHub Actions / .env.cloud)
req('SUPABASE_URL');
req('SUPABASE_SERVICE_ROLE_KEY');
req('FOOTBALL_DATA_API_KEY', 'FOOTBALL_DATA_API_KEY o API_FOOTBALL_KEY (sync)');

if (!process.env.FOOTBALL_DATA_API_KEY?.trim() && !process.env.API_FOOTBALL_KEY?.trim()) {
  errors.push('Configurar FOOTBALL_DATA_API_KEY o API_FOOTBALL_KEY para sync automático');
}

if (process.env.VITE_PUBLIC_DEMO === 'true') {
  errors.push('VITE_PUBLIC_DEMO=true — desactivar en Vercel producción');
}

if (process.env.VITE_USE_FOOTBALL_API === 'true' && !process.env.VITE_API_BASE_URL?.trim()) {
  warnings.push('VITE_USE_FOOTBALL_API=true sin VITE_API_BASE_URL — el frontend usará fallback Supabase');
}

if (process.env.VITE_API_BASE_URL?.trim()) {
  warnings.push('VITE_API_BASE_URL configurado — no necesario en modo producción $0 (Supabase-only)');
}

if (
  process.env.VITE_SUPABASE_ANON_KEY &&
  process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.VITE_SUPABASE_ANON_KEY
) {
  errors.push('SUPABASE_SERVICE_ROLE_KEY no debe ser igual a VITE_SUPABASE_ANON_KEY');
}

if (!process.env.VITE_SUPABASE_URL?.trim()) {
  warnings.push('VITE_SUPABASE_URL vacío — configurar en Vercel');
}

if (!process.env.VITE_SUPABASE_ANON_KEY?.trim()) {
  warnings.push('VITE_SUPABASE_ANON_KEY vacío — configurar en Vercel');
}

console.log('\n=== Validación entorno producción $0 ===\n');

if (errors.length === 0) {
  console.log('✔ Variables críticas OK');
} else {
  for (const e of errors) console.error(`✘ ${e}`);
}

for (const w of warnings) console.warn(`⚠ ${w}`);

console.log('\nVercel (Production):');
console.log('  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
console.log('  VITE_USE_FOOTBALL_API=false');
console.log('  VITE_PUBLIC_DEMO=false (o omitir)');
console.log('  NO VITE_API_BASE_URL, NO SUPABASE_SERVICE_ROLE_KEY\n');

console.log('GitHub Actions Secrets:');
console.log('  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_API_KEY\n');

process.exit(errors.length > 0 ? 1 : 0);
