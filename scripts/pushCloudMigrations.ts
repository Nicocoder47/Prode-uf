/**
 * Aplica migraciones SQL en Supabase cloud usando conexión directa Postgres.
 * npm run db:push:cloud
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadCloudEnv } from './lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL?.trim()
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim()
const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm'

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

async function pushViaPg() {
  if (!dbPassword) {
    console.log('\n⏭ db:push:cloud omitido — agregá SUPABASE_DB_PASSWORD en .env.cloud')
    console.log('  Supabase → Project Settings → Database → Database password\n')
    return false
  }

  const connectionString =
    process.env.SUPABASE_DB_URL?.trim() ||
    `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations_local (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `)

  const dir = join(process.cwd(), 'supabase', 'migrations')
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM public.schema_migrations_local WHERE filename = $1',
      [file]
    )
    if (rows.length > 0) {
      console.log(`⏭ ${file}`)
      continue
    }

    const sql = readFileSync(join(dir, file), 'utf8')
    console.log(`▶ ${file}`)
    await client.query(sql)
    await client.query('INSERT INTO public.schema_migrations_local (filename) VALUES ($1)', [file])
    console.log(`✓ ${file}`)
  }

  await client.end()
  console.log('\n✓ Migraciones SQL aplicadas')
  return true
}

async function main() {
  const rpcOk = await verifyRpc()
  const pushed = await pushViaPg()
  if (!pushed && !rpcOk) {
    process.exitCode = 1
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
