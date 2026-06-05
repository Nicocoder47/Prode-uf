import { readFileSync, existsSync } from 'node:fs';
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

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false } }
);

const EXISTING_FIELDS = [
  'shirt_number',
  'club',
  'market_value',
  'photo_url',
  'provider_player_id',
  'provider',
] as const;

const ENRICHMENT_FIELDS = ['height', 'preferred_foot', 'rating'] as const;

async function main() {
  const { data: sample, error: sampleErr } = await supabase.from('players').select('*').limit(1);
  if (sampleErr) {
    console.error(sampleErr.message);
    process.exit(1);
  }

  const available = new Set(Object.keys(sample?.[0] ?? {}));
  const fields = [...EXISTING_FIELDS, ...ENRICHMENT_FIELDS].filter(f => available.has(f));

  const { data, error } = await supabase.from('players').select(fields.join(','));
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  console.log(`Total players: ${rows.length}`);
  console.log(`Columns audited: ${fields.join(', ')}\n`);

  for (const field of fields) {
    const nullCount = rows.filter(r => r[field as keyof typeof r] == null).length;
    const pct = ((nullCount / rows.length) * 100).toFixed(1);
    console.log(`${field.padEnd(20)} null=${nullCount} (${pct}%)`);
  }

  const byProvider: Record<string, number> = {};
  for (const row of rows) {
    const p = String((row as { provider?: string }).provider ?? 'unknown');
    byProvider[p] = (byProvider[p] ?? 0) + 1;
  }
  console.log('\nBy provider:', byProvider);

  console.log('\nSample rows:');
  for (const row of rows.slice(0, 3)) {
    console.log(JSON.stringify(row));
  }
}

main();
