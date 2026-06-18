import ws from 'ws'
import { createClient } from '@supabase/supabase-js'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anon || !serviceKey) {
  console.error('Faltan env')
  process.exit(1)
}

const opts = {
  auth: { persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
}

const service = createClient(url, serviceKey, opts)
const anonClient = createClient(url, anon, opts)

const { data: profiles, error } = await service
  .from('profiles')
  .select('id,email,full_name,dni,legajo,is_active,is_blocked,deleted_at,must_change_password,password_changed_at,last_login_at,created_at')
  .is('deleted_at', null)
  .order('created_at', { ascending: false })

if (error) throw error

const active = (profiles ?? []).filter(p => p.is_active !== false && !p.is_blocked)

const changedPassword = active.filter(p => p.password_changed_at != null)
const mustChange = active.filter(p => p.must_change_password === true)
const neverLoggedIn = active.filter(p => !p.last_login_at)
const changedButMustChange = active.filter(
  p => p.password_changed_at != null && p.must_change_password === true,
)

console.log('=== RESUMEN USUARIOS ACTIVOS ===')
console.log('total activos:', active.length)
console.log('con password_changed_at:', changedPassword.length)
console.log('con must_change_password:', mustChange.length)
console.log('sin last_login_at:', neverLoggedIn.length)
console.log('cambiaron clave pero must_change sigue true:', changedButMustChange.length)

type LoginProbe = {
  email: string
  full_name: string
  legajo: string | null
  dni: string | null
  password_changed_at: string | null
  must_change_password: boolean
  last_login_at: string | null
  login_with_dni: 'ok' | 'fail' | 'skip'
  error?: string
}

const probes: LoginProbe[] = []
const sample = active.filter(p => p.dni && p.email)

for (const p of sample) {
  const row: LoginProbe = {
    email: p.email,
    full_name: p.full_name,
    legajo: p.legajo,
    dni: p.dni,
    password_changed_at: p.password_changed_at,
    must_change_password: p.must_change_password === true,
    last_login_at: p.last_login_at,
    login_with_dni: 'skip',
  }

  const { error: signErr } = await anonClient.auth.signInWithPassword({
    email: p.email.trim().toLowerCase(),
    password: String(p.dni).replace(/\D/g, ''),
  })

  if (signErr) {
    row.login_with_dni = 'fail'
    row.error = signErr.message
  } else {
    row.login_with_dni = 'ok'
    await anonClient.auth.signOut()
  }

  probes.push(row)
}

const fails = probes.filter(p => p.login_with_dni === 'fail')
const oks = probes.filter(p => p.login_with_dni === 'ok')

console.log('\n=== PROBE LOGIN (email + DNI) ===')
console.log('ok:', oks.length)
console.log('fail:', fails.length)

console.log('\n=== USUARIOS QUE NO ENTRAN CON DNI (todos) ===')
for (const f of fails) {
  console.log(`- ${f.full_name} | ${f.email} | legajo ${f.legajo ?? '—'} | pwd_changed: ${f.password_changed_at ? 'sí' : 'no'} | must_change: ${f.must_change_password}`)
}

console.log('\n=== PATRÓN: cambió clave + falla DNI ===')
const pattern = fails.filter(f => f.password_changed_at)
console.log('count:', pattern.length)
for (const f of pattern.slice(0, 15)) {
  console.log(`  ${f.email} | changed ${f.password_changed_at?.slice(0, 19)}`)
}

import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync('reports', { recursive: true })
writeFileSync('reports/login-audit.json', JSON.stringify({
  generated_at: new Date().toISOString(),
  summary: {
    active_users: active.length,
    password_changed_at: changedPassword.length,
    must_change_password: mustChange.length,
    never_logged_in: neverLoggedIn.length,
    login_dni_ok: oks.length,
    login_dni_fail: fails.length,
    changed_password_and_fail: pattern.length,
  },
  failures: fails,
}, null, 2))

console.log('\nReporte: reports/login-audit.json')
