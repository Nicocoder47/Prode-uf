/**
 * Aplica migraciones SQL en Supabase cloud vía Management API.
 * Requiere SUPABASE_ACCESS_TOKEN (Personal Access Token o sesión dashboard).
 *
 * npm run db:apply:management
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadCloudEnv } from './lib/loadCloudEnv.js'

loadCloudEnv()

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm'

if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN')
  console.error('Obtené uno en https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

async function runSql(query: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 800)}`)
  }
  return body
}

async function main() {
  const only = process.argv[2]
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .filter(f => !only || f.includes(only))

  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8')
    console.log(`▶ ${file}`)
    await runSql(sql)
    console.log(`✓ ${file}`)
  }

  console.log('\n✓ Migraciones aplicadas vía Management API')
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
