/**
 * Aplica solo migraciones pendientes en schema_migrations_local (ignora validate_registration).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim();
const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm';

if (!dbPassword) {
  console.error('Falta SUPABASE_DB_PASSWORD en .env.cloud');
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL?.trim() ||
  `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS public.schema_migrations_local (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
`);

const dir = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(dir)
  .filter(f => f.endsWith('.sql'))
  .sort();

for (const file of files) {
  const { rows } = await client.query('SELECT 1 FROM public.schema_migrations_local WHERE filename = $1', [file]);
  if (rows.length > 0) {
    console.log(`⏭ ${file}`);
    continue;
  }

  const sql = readFileSync(join(dir, file), 'utf8');
  console.log(`▶ ${file}`);
  await client.query(sql);
  await client.query('INSERT INTO public.schema_migrations_local (filename) VALUES ($1)', [file]);
  console.log(`✓ ${file}`);
}

await client.end();
console.log('Done');
