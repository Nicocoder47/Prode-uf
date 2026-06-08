/**
 * Limpia usuarios Auth (cascade: perfiles, predicciones) para reiniciar login con DNI.
 * Uso: npm run reset:auth
 */
import { loadCloudEnv } from './lib/loadCloudEnv.ts'

loadCloudEnv()

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.cloud')
  process.exit(1)
}

type AuthUser = { id: string; email?: string }

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

async function deleteAllAuthUsers() {
  let deleted = 0
  let page = 1

  while (true) {
    const data = await adminFetch<{ users: AuthUser[] }>(`/users?page=${page}&per_page=100`)
    if (!data.users.length) break

    for (const user of data.users) {
      await adminFetch(`/users/${user.id}`, { method: 'DELETE' })
      deleted++
      console.log(`  - eliminado: ${user.email ?? user.id}`)
    }

    if (data.users.length < 100) break
    page++
  }

  return deleted
}

async function main() {
  console.log('Reiniciando auth Supabase (email + DNI como contraseña)…\n')

  const users = await deleteAllAuthUsers()
  console.log(`\nUsuarios eliminados: ${users}`)
  console.log('Perfiles y predicciones se borran en cascada.')
  console.log('\nListo. Todos deben registrarse de nuevo en /login')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
