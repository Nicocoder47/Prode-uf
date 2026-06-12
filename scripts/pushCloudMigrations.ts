/**
 * Aplica migraciones SQL en Supabase cloud.
 * 1) Postgres directo (pooler) si SUPABASE_DB_PASSWORD funciona
 * 2) Management API si hay SUPABASE_ACCESS_TOKEN
 * npm run db:push:cloud
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadCloudEnv } from './lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL?.trim()
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim()
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm'

function migrationFiles() {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  return readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()
}

async function verifyRpc(): Promise<boolean> {
  if (!url || !serviceKey) return false
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/validate_registration`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_email: 'probe@example.com',
      p_dni: '30123456',
      p_legajo: '99999',
    }),
  })
  const body = await res.text()
  if (res.ok || body.includes('"ok"')) {
    console.log('✔ validate_registration (DNI/legajo) disponible')
    return true
  }
  if (body.includes('Could not find the function') || body.includes('PGRST202')) {
    console.log('⚠ Falta migración DNI/legajo en Supabase')
    return false
  }
  console.log(`⚠ validate_registration: HTTP ${res.status} — ${body.slice(0, 120)}`)
  return false
}

async function ensureMigrationsTablePg(client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations_local (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `)
}

async function mgmtQuery(query: string) {
  if (!accessToken) {
    throw new Error('Falta SUPABASE_ACCESS_TOKEN en .env.cloud')
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${body.slice(0, 400)}`)
  }

  try {
    return JSON.parse(body) as unknown
  } catch {
    return body
  }
}

async function listAppliedMigrationsPg(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { filename: string }[] }> },
) {
  const { rows } = await client.query('SELECT filename FROM public.schema_migrations_local')
  return new Set(rows.map(row => row.filename))
}

function sqlLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

async function listAppliedMigrationsMgmt() {
  await mgmtQuery(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations_local (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `)
  const rows = (await mgmtQuery('SELECT filename FROM public.schema_migrations_local')) as { filename: string }[]
  return new Set(rows.map(row => row.filename))
}

/** DB productiva ya migrada antes del tracker local: registrar baseline y dejar solo pendientes nuevas. */
async function bootstrapMigrationTrackerIfNeeded(
  applied: Set<string>,
  markApplied: (filename: string) => Promise<void>,
) {
  if (applied.size > 0) return

  const files = migrationFiles()
  const rows = (await mgmtQuery(
    `SELECT to_regclass('public.matches') AS matches, to_regclass('public.admin_cards') AS admin_cards`,
  )) as { matches: string | null; admin_cards: string | null }[]

  const hasSchema = Boolean(rows[0]?.matches ?? rows[0]?.admin_cards)
  if (!hasSchema) return

  const keepPending = new Set([
    '20240130000000_competition_display_settings.sql',
    '20240131000000_ranking_lore_settings.sql',
  ])
  const baseline = files.filter(file => !keepPending.has(file))

  for (const file of baseline) {
    await markApplied(file)
    applied.add(file)
  }

  console.log(`✔ Baseline cloud: ${baseline.length} migraciones previas registradas`)
}

async function applyMigrations(
  applied: Set<string>,
  runSql: (sql: string) => Promise<void>,
  markApplied: (filename: string) => Promise<void>,
) {
  for (const file of migrationFiles()) {
    if (applied.has(file)) {
      console.log(`⏭ ${file}`)
      continue
    }

    const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', file), 'utf8')
    console.log(`▶ ${file}`)
    await runSql(sql)
    await markApplied(file)
    console.log(`✓ ${file}`)
  }

  console.log('\n✓ Migraciones SQL aplicadas')
}

async function pushViaPg() {
  if (!dbPassword) {
    console.log('\n⏭ Postgres omitido — sin SUPABASE_DB_PASSWORD')
    return false
  }

  const encoded = encodeURIComponent(dbPassword)
  const candidates = [
    process.env.SUPABASE_DB_URL?.trim(),
    `postgresql://postgres.${ref}:${encoded}@aws-1-us-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${ref}:${encoded}@aws-1-us-east-1.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.${ref}:${encoded}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${ref}:${encoded}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`,
  ].filter(Boolean) as string[]

  const { default: pg } = await import('pg')
  let client: InstanceType<typeof pg.Client> | null = null
  let lastErr: unknown
  for (const connectionString of candidates) {
    const probe = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
    try {
      await probe.connect()
      client = probe
      console.log('✔ Conectado a Postgres cloud')
      break
    } catch (err) {
      lastErr = err
      await probe.end().catch(() => {})
    }
  }
  if (!client) {
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  }

  await ensureMigrationsTablePg(client)
  const applied = await listAppliedMigrationsPg(client)

  await applyMigrations(
    applied,
    async sql => {
      await client!.query(sql)
    },
    async file => {
      await client!.query('INSERT INTO public.schema_migrations_local (filename) VALUES ($1)', [file])
    },
  )

  await client.end()
  return true
}

async function pushViaManagementApi() {
  if (!accessToken) {
    console.log('\n⏭ Management API omitida — sin SUPABASE_ACCESS_TOKEN')
    return false
  }

  console.log('✔ Usando Supabase Management API')
  const applied = await listAppliedMigrationsMgmt()
  const markApplied = async (file: string) => {
    await mgmtQuery(`INSERT INTO public.schema_migrations_local (filename) VALUES (${sqlLiteral(file)})`)
  }

  await bootstrapMigrationTrackerIfNeeded(applied, markApplied)

  await applyMigrations(
    applied,
    async sql => {
      await mgmtQuery(sql)
    },
    markApplied,
  )

  return true
}

async function main() {
  const rpcOk = await verifyRpc()

  try {
    const pushed = await pushViaPg()
    if (pushed) return
  } catch (err) {
    console.log('⚠ Postgres directo falló — probando Management API')
    console.log(`  ${err instanceof Error ? err.message : err}`)
  }

  try {
    const pushed = await pushViaManagementApi()
    if (!pushed) process.exitCode = 1
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
