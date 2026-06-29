/**
 * Consulta perfil/predicciones y restablece contraseña a DNI para un usuario.
 * Uso: npx tsx scripts/release/fixUserLogin.ts <dni>
 */
import ws from 'ws'
import { createClient } from '@supabase/supabase-js'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const dni = (process.argv[2] ?? '').replace(/\D/g, '')
if (!dni) {
  console.error('Uso: npx tsx scripts/release/fixUserLogin.ts <dni>')
  process.exit(1)
}

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

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${url}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey!,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`)
  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

const { data: profiles, error } = await service
  .from('profiles')
  .select('id,email,full_name,dni,legajo,is_active,is_blocked,deleted_at,must_change_password,password_changed_at,last_login_at,token_balance')
  .eq('dni', dni)

if (error) throw error

const profile = profiles?.[0]
if (!profile) {
  console.error(`No se encontró usuario con DNI ${dni}`)
  process.exit(1)
}

console.log('=== PERFIL ===')
console.log(JSON.stringify(profile, null, 2))

const { data: predictions, error: predErr } = await service
  .from('predictions')
  .select('id,match_id,predicted_score_home,predicted_score_away,predicted_winner,status,points,created_at,updated_at,scored_at')
  .eq('user_id', profile.id)
  .order('created_at', { ascending: true })

if (predErr) throw predErr

console.log('\n=== PREDICCIONES ===')
console.log(`Total: ${predictions?.length ?? 0}`)
for (const p of predictions ?? []) {
  console.log(
    `  match ${p.match_id} | ${p.predicted_score_home ?? '—'}-${p.predicted_score_away ?? '—'} | winner=${p.predicted_winner ?? '—'} | ${p.status} | pts=${p.points ?? 0}`,
  )
}

const byStatus = (predictions ?? []).reduce(
  (acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  },
  {} as Record<string, number>,
)

console.log('\nResumen por estado:', byStatus)

console.log('\n=== RESTABLECIENDO CONTRASEÑA A DNI ===')
await adminFetch(`/users/${profile.id}`, {
  method: 'PUT',
  body: JSON.stringify({
    password: dni,
    email_confirm: true,
  }),
})

const { error: profileUpdateErr } = await service
  .from('profiles')
  .update({
    must_change_password: false,
    password_changed_at: null,
    is_active: true,
    is_blocked: false,
    updated_at: new Date().toISOString(),
  })
  .eq('id', profile.id)

if (profileUpdateErr) console.warn('No se pudo actualizar perfil:', profileUpdateErr.message)
else console.log('Perfil actualizado: clave=DNI, cuenta activa')

const { error: signErr } = await anonClient.auth.signInWithPassword({
  email: profile.email.trim().toLowerCase(),
  password: dni,
})

if (signErr) {
  console.error('PROBE LOGIN FALLÓ:', signErr.message)
  process.exit(1)
}

console.log('PROBE LOGIN OK con email + DNI')
await anonClient.auth.signOut()
console.log(`\nListo. ${profile.full_name} puede entrar con:`)
console.log(`  Email: ${profile.email}`)
console.log(`  Contraseña: ${dni}`)
