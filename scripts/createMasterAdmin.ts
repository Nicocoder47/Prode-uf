/**
 * Crea o actualiza la cuenta admin maestra (email confirmado, rol admin).
 * Login en la app: email + DNI como contraseña.
 *
 * Uso: npm run admin:create-master
 *
 * Variables opcionales en .env.cloud:
 *   MASTER_ADMIN_EMAIL, MASTER_ADMIN_DNI, MASTER_ADMIN_LEGAJO, MASTER_ADMIN_NAME
 */
import { writeFileSync } from 'node:fs'
import { loadCloudEnv } from './lib/loadCloudEnv.ts'

loadCloudEnv()

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const MASTER_EMAIL = (process.env.MASTER_ADMIN_EMAIL ?? 'maestro@prodemundial.prode').trim().toLowerCase()
const MASTER_DNI = (process.env.MASTER_ADMIN_DNI ?? '47000001').replace(/\D/g, '')
const MASTER_LEGAJO = (process.env.MASTER_ADMIN_LEGAJO ?? 'MAESTRO').trim().toUpperCase()
const MASTER_NAME = (process.env.MASTER_ADMIN_NAME ?? 'Admin Maestro').trim()

if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.cloud')
  process.exit(1)
}

if (MASTER_DNI.length < 7 || MASTER_DNI.length > 8) {
  console.error('MASTER_ADMIN_DNI debe tener 7 u 8 dígitos (es la contraseña en /login)')
  process.exit(1)
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${url}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${path} → ${res.status}: ${body}`)
  }

  if (res.status === 204) return {} as T
  return res.json() as Promise<T>
}

async function restRpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`rpc ${fn} → ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

type AuthUser = { id: string; email?: string }

async function findUserByEmail(email: string): Promise<AuthUser | null> {
  let page = 1
  while (true) {
    const data = await adminFetch<{ users: AuthUser[] }>(`/users?page=${page}&per_page=100`)
    const match = data.users.find(u => u.email?.toLowerCase() === email)
    if (match) return match
    if (data.users.length < 100) break
    page++
  }
  return null
}

async function main() {
  console.log('Creando cuenta admin maestra…\n')

  let user = await findUserByEmail(MASTER_EMAIL)

  if (user) {
    await adminFetch(`/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        password: MASTER_DNI,
        email_confirm: true,
        user_metadata: {
          full_name: MASTER_NAME,
          dni: MASTER_DNI,
          legajo: MASTER_LEGAJO,
        },
      }),
    })
    console.log(`Usuario existente actualizado: ${MASTER_EMAIL}`)
  } else {
    user = await adminFetch<AuthUser>('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: MASTER_EMAIL,
        password: MASTER_DNI,
        email_confirm: true,
        user_metadata: {
          full_name: MASTER_NAME,
          dni: MASTER_DNI,
          legajo: MASTER_LEGAJO,
        },
      }),
    })
    console.log(`Usuario creado: ${MASTER_EMAIL}`)
  }

  await restRpc('sync_user_profile_admin', {
    p_user_id: user.id,
    p_full_name: MASTER_NAME,
    p_dni: MASTER_DNI,
    p_legajo: MASTER_LEGAJO,
    p_email: MASTER_EMAIL,
  })

  const credentials = {
    loginUrl: 'https://prodemundialprode.vercel.app/login',
    email: MASTER_EMAIL,
    dniPassword: MASTER_DNI,
    legajo: MASTER_LEGAJO,
    adminPanel: 'https://prodemundialprode.vercel.app/admin',
    note: 'En /login elegí Iniciar sesión. Email + DNI (como contraseña). No compartir públicamente.',
  }

  writeFileSync('reports/master-admin-credentials.json', JSON.stringify(credentials, null, 2))

  console.log('\n=== CUENTA MAESTRA LISTA ===')
  console.log(`Email:      ${MASTER_EMAIL}`)
  console.log(`Contraseña: ${MASTER_DNI}  (tu DNI en la pantalla de login)`)
  console.log(`Legajo:     ${MASTER_LEGAJO}`)
  console.log(`Admin:      ${credentials.adminPanel}`)
  console.log('\nGuardado en reports/master-admin-credentials.json (no commitear)')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
