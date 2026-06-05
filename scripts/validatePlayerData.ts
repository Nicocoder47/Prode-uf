import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  fieldCoverage,
  hasReliableExternalId,
  identityKeyDuplicates,
  PLAYER_TRACE_SELECT,
  type PlayerTraceRow,
} from '../src/services/footballData/playerDataQuality';

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

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false } },
);

const THRESHOLDS = {
  photo_url: 80,
  club: 70,
  date_of_birth: 60,
  height: 50,
  market_value: 40,
  position: 90,
  nationality: 70,
};

const TRUSTED_MARKET_SOURCES = ['transfermarkt', 'api-football', 'sportmonks'];

async function fetchAll(): Promise<PlayerTraceRow[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: PlayerTraceRow[] = [];
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select(PLAYER_TRACE_SELECT)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as PlayerTraceRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

function sourceOf(p: PlayerTraceRow, field: string): string | null {
  const s = (p.data_sources ?? {})[field] as unknown;
  if (!s) return null;
  if (typeof s === 'string') return s;
  return (s as { source?: string }).source ?? null;
}

async function runStrict(rows: PlayerTraceRow[]) {
  const failures: string[] = [];
  const lines: string[] = [];

  // 1. publicados sin external_id confiable (publicado = quality >= 80 o verified)
  const published = rows.filter(p => (p.data_quality_score ?? 0) >= 80 || p.verification_status === 'verified');
  const noExternal = published.filter(p => !hasReliableExternalId(p));
  if (noExternal.length) failures.push(`${noExternal.length} jugadores publicados sin external_id confiable`);

  // 2. países sin fifa_code o iso3
  const { data: teams } = await supabase.from('teams').select('id,name,fifa_code,iso3');
  const badCountries = (teams ?? []).filter(t => !t.fifa_code || !t.iso3);
  if (badCountries.length) failures.push(`${badCountries.length} países sin fifa_code o iso3`);

  // 3. verification_status conflict
  const conflicts = rows.filter(p => p.verification_status === 'conflict');
  if (conflicts.length) failures.push(`${conflicts.length} jugadores con verification_status=conflict`);

  // 4. fotos sin fuente
  const photoNoSource = rows.filter(p => p.photo_url && !sourceOf(p, 'photo_url'));
  if (photoNoSource.length) failures.push(`${photoNoSource.length} fotos sin fuente trazable`);

  // 5. valores de mercado sin fuente autorizada
  const mvBad = rows.filter(p => {
    if (!p.market_value_eur) return false;
    const src = sourceOf(p, 'market_value');
    return !src || !TRUSTED_MARKET_SOURCES.includes(src);
  });
  if (mvBad.length) failures.push(`${mvBad.length} valores de mercado sin fuente autorizada`);

  // 6. duplicados con misma identity_key
  const dupes = identityKeyDuplicates(rows);
  if (dupes.length) failures.push(`${dupes.length} grupos de jugadores con misma identidad`);

  // 7. data_quality alto con identity bajo
  const mismatch = rows.filter(
    p => (p.data_quality_score ?? 0) >= 80 && (p.identity_confidence_score ?? 0) < 70,
  );
  if (mismatch.length) failures.push(`${mismatch.length} jugadores con calidad alta pero identidad baja`);

  lines.push('# Validación Estricta — Sprint V2');
  lines.push('');
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Total jugadores: ${rows.length}`);
  lines.push('');
  lines.push('## Chequeos');
  lines.push('');
  const checks = [
    ['Publicados sin external_id', noExternal.length],
    ['Países sin fifa_code/iso3', badCountries.length],
    ['verification_status=conflict', conflicts.length],
    ['Fotos sin fuente', photoNoSource.length],
    ['Market value sin fuente autorizada', mvBad.length],
    ['Duplicados por identidad', dupes.length],
    ['Calidad alta / identidad baja', mismatch.length],
  ] as const;
  lines.push('| Chequeo | Violaciones |');
  lines.push('|---------|------------:|');
  for (const [label, n] of checks) lines.push(`| ${label} | ${n} |`);

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/player-data-validation-strict.md', lines.join('\n'));

  console.log('\n=== validate:player-data --strict ===\n');
  for (const [label, n] of checks) {
    console.log(`${n === 0 ? 'OK  ' : 'FAIL'} ${label}: ${n}`);
  }

  if (failures.length) {
    console.log('\n--- STRICT validation FAILED ---');
    for (const f of failures) console.log(` - ${f}`);
    console.log('\nReporte: reports/player-data-validation-strict.md\n');
    process.exit(1);
  }
  console.log('\n--- STRICT validation passed ---\n');
  process.exit(0);
}

function runNormal(rows: PlayerTraceRow[]) {
  const coverage = fieldCoverage(rows as unknown as Record<string, unknown>[]);
  const map = Object.fromEntries(coverage.map(c => [c.dbKey, c.pct]));

  console.log('\n=== validate:player-data ===\n');
  let failed = false;
  const warnings: string[] = [];

  for (const [key, min] of Object.entries(THRESHOLDS)) {
    const pct = map[key] ?? 0;
    const label = coverage.find(c => c.dbKey === key)?.field ?? key;
    const line = `${label.padEnd(16)} ${pct}% (min ${min}%)`;
    if (key === 'position' || key === 'nationality') {
      if (pct < min) warnings.push(`WARN ${line}`);
      else console.log(`OK   ${line}`);
    } else if (pct < min) {
      console.log(`FAIL ${line}`);
      failed = true;
    } else {
      console.log(`OK   ${line}`);
    }
  }

  for (const w of warnings) console.log(w);
  console.log(failed ? '\n--- Validation FAILED ---\n' : '\n--- Validation passed ---\n');
  process.exit(failed ? 1 : 0);
}

async function main() {
  let rows: PlayerTraceRow[];
  try {
    rows = await fetchAll();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
    return;
  }

  if (process.argv.includes('--strict')) {
    await runStrict(rows);
  } else {
    runNormal(rows);
  }
}

main();
