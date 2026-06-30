import { readFileSync } from 'node:fs'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const token = process.env.SUPABASE_ACCESS_TOKEN!
const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm'

async function apply(file: string) {
  const sql = readFileSync(file, 'utf8')
  console.log('Applying', file)
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${file} HTTP ${res.status}: ${body.slice(0, 400)}`)
  console.log('OK', body.slice(0, 120))
}

async function main() {
  await apply('supabase/migrations/20240630100000_fix_scoring_record_cast.sql')
  await apply('supabase/migrations/20240630110000_admin_predictions_knockout_display.sql')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
