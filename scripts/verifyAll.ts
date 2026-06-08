/**
 * Verificación post-reset: login, plantel, equipos, logo en prod.
 * npm run verify:all
 */
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { readFileSync, existsSync } from 'node:fs'
import { loadCloudEnv } from './lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const algeriaId = 'aaad1bc4-29fc-49a9-a562-5c34cf5f8cf4'
const argentinaId = '9308ef2e-4b9f-41c6-ba00-834a59fb11b0'
const prod = 'https://prodemundialprode.vercel.app'

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile('reports/master-admin-credentials.json')

let email = process.env.MASTER_ADMIN_EMAIL ?? 'maestro@prodemundial.prode'
let password = process.env.MASTER_ADMIN_DNI ?? '47000001'
if (existsSync('reports/master-admin-credentials.json')) {
  try {
    const creds = JSON.parse(readFileSync('reports/master-admin-credentials.json', 'utf8')) as {
      email?: string
      dniPassword?: string
    }
    if (creds.email) email = creds.email
    if (creds.dniPassword) password = creds.dniPassword
  } catch {
    /* ignore */
  }
}

const supabase = createClient(url!, anonKey!, {
  auth: { persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const results: { check: string; ok: boolean; detail: string }[] = []

function record(check: string, ok: boolean, detail: string) {
  results.push({ check, ok, detail })
  console.log(`${ok ? '✔' : '✗'} ${check}: ${detail}`)
}

async function main() {
  console.log('=== Verificación PRODEMUNDIAL ===\n')

  const login = await supabase.auth.signInWithPassword({ email, password })
  record(
    'Login maestro',
    !login.error && !!login.data.session,
    login.error?.message ?? `sesión OK (${login.data.user?.email})`,
  )

  if (login.data.session) {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('full_name, dni, legajo, role')
      .eq('id', login.data.user!.id)
      .single()

    record(
      'Perfil maestro',
      !profileErr && !!profile?.dni && !!profile?.legajo,
      profileErr?.message ?? `${profile?.full_name} · legajo ${profile?.legajo} · rol ${profile?.role}`,
    )

    for (const [name, teamId] of [
      ['Plantel Arg', argentinaId],
      ['Plantel Argelia', algeriaId],
    ] as const) {
      const { data, error } = await supabase
        .from('players')
        .select('id,name,shirt_number')
        .eq('team_id', teamId)
        .limit(5)

      record(name, !error && (data?.length ?? 0) > 0, error?.message ?? `${data?.length ?? 0}+ jugadores`)
    }

    const { data: teams, error: teamsErr } = await supabase.from('teams').select('id').limit(1)
    record('Equipos (auth)', !teamsErr && (teams?.length ?? 0) > 0, teamsErr?.message ?? 'OK')

    const { data: lb, error: lbErr } = await supabase.from('leaderboard').select('user_id').limit(1)
    record('Leaderboard', !lbErr, lbErr?.message ?? `${lb?.length ?? 0} filas`)
  }

  const loginHtml = await fetch(`${prod}/login`).then(r => r.text())
  record('Prod /login HTTP', loginHtml.includes('<!doctype html') || loginHtml.includes('<!DOCTYPE html'), '200 OK')

  const logoAsset = await fetch(`${prod}/logo-union-ferroviaria.png`)
  record(
    'Logo seccional (asset)',
    logoAsset.ok,
    logoAsset.ok ? `${logoAsset.headers.get('content-type')}` : `HTTP ${logoAsset.status}`,
  )

  const indexHtml = await fetch(prod).then(r => r.text())
  const jsMatch = indexHtml.match(/src="(\/assets\/index-[^"]+\.js)"/)
  if (jsMatch) {
    const bundle = await fetch(`${prod}${jsMatch[1]}`).then(r => r.text())
    record(
      'App bundle carga',
      bundle.length > 10000,
      `${Math.round(bundle.length / 1024)} KB`,
    )
    record(
      'Logo en bundle JS',
      bundle.includes('logo-union-ferroviaria') || bundle.includes('SeccionalLogo'),
      bundle.includes('logo-union-ferroviaria') ? 'referenciado' : 'componente presente',
    )
  } else {
    record('App bundle carga', false, 'no se encontró chunk index en HTML')
  }

  const rpc = await fetch(`${url}/rest/v1/rpc/validate_registration`, {
    method: 'POST',
    headers: {
      apikey: anonKey!,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_email: 'test@example.com', p_dni: '30123456', p_legajo: 'TEST99' }),
  })
  const rpcBody = await rpc.text()
  record(
    'RPC validate_registration',
    rpc.ok && rpcBody.includes('"ok"'),
    rpc.ok ? 'disponible' : rpcBody.slice(0, 80),
  )

  await supabase.auth.signOut()

  console.log('\n=== Resumen ===')
  const failed = results.filter(r => !r.ok)
  if (failed.length === 0) {
    console.log('Todo OK (' + results.length + ' checks)\n')
    console.log('Login de prueba:')
    console.log(`  Email: ${email}`)
    console.log(`  DNI:   ${password}`)
    process.exit(0)
  } else {
    console.log(`${failed.length} fallo(s):`)
    for (const f of failed) console.log(`  - ${f.check}: ${f.detail}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
