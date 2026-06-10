import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim()
const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm'

async function main() {
  if (!dbPassword) {
    console.error('FAIL: SUPABASE_DB_PASSWORD missing in .env.cloud')
    process.exit(1)
  }

  const encoded = encodeURIComponent(dbPassword)
  const candidates = [
    process.env.SUPABASE_DB_URL?.trim(),
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
      console.log('Connected:', connectionString.replace(encoded, '***'))
      break
    } catch (err) {
      lastErr = err
      await probe.end().catch(() => {})
    }
  }
  if (!client) {
    console.error('APPLY: FAIL — no Postgres connection succeeded')
    console.error(lastErr instanceof Error ? lastErr.message : lastErr)
    process.exit(1)
  }

  const applySql = readFileSync('supabase/scripts/admin_v3_beta_300_consolidated.sql', 'utf8')
  const verifySql = readFileSync('supabase/scripts/admin_v3_beta_300_verify.sql', 'utf8')

  try {
    await client.query(applySql)
    console.log('APPLY: OK — admin_v3_beta_300_consolidated.sql')
  } catch (err) {
    console.error('APPLY: FAIL —', err instanceof Error ? err.message : err)
    process.exit(1)
  }

  const statements = verifySql
    .split(';')
    .map(s => s.replace(/^--[^\n]*\n?/gm, '').trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  const results: Record<string, unknown> = {}
  const labels = [
    'tables',
    'profiles_columns',
    'device_reports_indexes',
    'device_reports_rls',
    'rpc_functions',
    'grants_authenticated',
    'registration_open',
    'security_counts',
  ]

  for (let i = 0; i < statements.length; i++) {
    const label = labels[i] ?? `query_${i}`
    try {
      const res = await client.query(statements[i]!)
      results[label] = res.rows
      console.log(`VERIFY ${label}: ${res.rows.length} rows`)
    } catch (err) {
      results[label] = { error: err instanceof Error ? err.message : String(err) }
      console.error(`VERIFY ${label}: FAIL —`, err instanceof Error ? err.message : err)
    }
  }

  const outDir = join(process.cwd(), 'reports')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'cloud-verify-admin-v3.json'), JSON.stringify(results, null, 2))
  console.log('Report: reports/cloud-verify-admin-v3.json')

  await client.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
