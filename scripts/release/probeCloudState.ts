import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function main() {
  if (!url || !serviceKey) {
    console.error('FAIL: missing cloud credentials')
    process.exit(1)
  }

  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  })

  const report: Record<string, unknown> = {}

  for (const table of ['admin_settings', 'device_reports', 'system_capacity_snapshots']) {
    const { error, count } = await sb.from(table).select('*', { count: 'exact', head: true })
    report[table] = error ? { exists: false, error: error.message } : { exists: true, count }
    console.log(`TABLE ${table}:`, error ? `MISSING/FAIL ${error.message}` : `OK count=${count}`)
  }

  const { data: settings, error: settingsErr } = await sb
    .from('admin_settings')
    .select('key, value')
    .eq('key', 'registration_open')
    .maybeSingle()
  report.registration_open = settingsErr ? { error: settingsErr.message } : settings
  console.log('registration_open:', settingsErr ? settingsErr.message : JSON.stringify(settings))

  const { data: profiles, error: profErr } = await sb
    .from('profiles')
    .select('id, role, must_change_password, is_blocked, deleted_at')
    .limit(3)
  report.profiles_sample = profErr ? { error: profErr.message } : profiles
  console.log('profiles columns probe:', profErr ? profErr.message : `ok sample=${profiles?.length}`)

  const outDir = join(process.cwd(), 'reports')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'cloud-probe-state.json'), JSON.stringify(report, null, 2))
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
