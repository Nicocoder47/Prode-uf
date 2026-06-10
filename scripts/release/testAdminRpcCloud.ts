import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const clientOpts = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
} as const

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const adminEmail = (process.env.MASTER_ADMIN_EMAIL ?? 'maestro@prodemundial.prode').trim().toLowerCase()
const adminPassword = (process.env.MASTER_ADMIN_DNI ?? '47000001').replace(/\D/g, '')

async function main() {
  if (!url || !anonKey) {
    console.error('FAIL: missing SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    process.exit(1)
  }

  const userClient = createClient(url, anonKey, clientOpts)

  const { data: signIn, error: signInErr } = await userClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })

  if (signInErr || !signIn.session) {
    console.error('FAIL: admin sign-in', signInErr?.message)
    console.error('Hint: configure MASTER_ADMIN_EMAIL / MASTER_ADMIN_DNI in .env.cloud')
    process.exit(1)
  }

  console.log('Admin session OK:', adminEmail)

  const authed = createClient(url, anonKey, {
    ...clientOpts,
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  })

  const report: Record<string, unknown> = { admin_email: adminEmail }

  const { data: regStatus, error: regErr } = await authed.rpc('admin_get_registration_status')
  report.admin_get_registration_status = regErr ? { error: regErr.message } : regStatus
  console.log('RPC admin_get_registration_status:', regErr ? `FAIL ${regErr.message}` : 'OK', JSON.stringify(regStatus))

  const { data: betaCap, error: betaErr } = await authed.rpc('admin_get_beta_capacity')
  report.admin_get_beta_capacity = betaErr ? { error: betaErr.message } : betaCap
  if (betaErr) {
    console.log('RPC admin_get_beta_capacity: FAIL', betaErr.message)
  } else {
    const b = betaCap as Record<string, unknown>
    const checks = {
      status: b.status != null,
      recommendation: b.recommendation != null,
      registration_open: b.registration_open != null,
      device_health: b.device_health != null,
    }
    report.beta_capacity_checks = checks
    console.log('RPC admin_get_beta_capacity: OK', checks)
    console.log('  status:', b.status, '| registration_open:', b.registration_open)
  }

  const { data: users, error: usersErr } = await authed.rpc('admin_get_users')
  if (usersErr) {
    report.admin_get_users = { error: usersErr.message }
    console.log('RPC admin_get_users: FAIL', usersErr.message)
  } else {
    const list = users as Array<Record<string, unknown>>
    const sample = list[0]
    const hasMasked = sample ? 'dni_masked' in sample : false
    const hasFullDni = sample ? 'dni' in sample : false
    report.admin_get_users = {
      count: list.length,
      has_dni_masked: hasMasked,
      exposes_full_dni: hasFullDni,
      sample_keys: sample ? Object.keys(sample).sort() : [],
    }
    console.log('RPC admin_get_users: OK', `count=${list.length}`, `dni_masked=${hasMasked}`, `full_dni=${hasFullDni}`)
  }

  const outDir = join(process.cwd(), 'reports')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'cloud-admin-rpc-tests.json'), JSON.stringify(report, null, 2))
  console.log('Report: reports/cloud-admin-rpc-tests.json')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
