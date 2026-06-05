import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
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

const sb = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false } },
);

async function main() {
  const { data: teams, error } = await sb
    .from('teams')
    .select('id,name,verification_status,fifa_code,iso3,iso2,confederation')
    .order('name');
  if (error) throw error;

  const rows = teams ?? [];
  const by = (s: string) => rows.filter(t => (t.verification_status ?? 'unlinked') === s).length;
  const missingCodes = rows.filter(t => !t.fifa_code || !t.iso3).length;
  const conflicts = by('conflict');
  const verified = by('verified');
  const unlinked = by('unlinked');

  const report = {
    generatedAt: new Date().toISOString(),
    total: rows.length,
    verified,
    needsReview: by('needs_review'),
    conflict: conflicts,
    unlinked,
    missingCodes,
    ok: conflicts === 0 && unlinked === 0 && verified === rows.length,
    teams: rows.map(t => ({
      id: t.id,
      name: t.name,
      status: t.verification_status ?? 'unlinked',
      fifaCode: t.fifa_code,
      iso3: t.iso3,
    })),
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/countries-final.json', JSON.stringify(report, null, 2));

  console.log('\n=== VALIDACIÓN PAÍSES / SELECCIONES ===\n');
  console.log(`Total: ${report.total}`);
  console.log(`Verified: ${verified}`);
  console.log(`Needs review: ${report.needsReview}`);
  console.log(`Conflict: ${conflicts}`);
  console.log(`Unlinked: ${unlinked}`);
  console.log(`Sin fifa_code/iso3: ${missingCodes}`);
  console.log(`\nResultado: ${report.ok ? 'OK — 48 equipos verified, 0 conflictos' : 'PENDIENTE — ejecutar npm run link:countries'}`);
  console.log('\nReporte: reports/countries-final.json');

  if (conflicts > 0) {
    console.log('\nConflictos (muestra):');
    for (const t of rows.filter(r => r.verification_status === 'conflict').slice(0, 10)) {
      console.log(`  ${t.name} — fifa:${t.fifa_code ?? '?'} iso3:${t.iso3 ?? '?'}`);
    }
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
