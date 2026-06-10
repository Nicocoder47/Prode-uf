import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!
const anon = process.env.VITE_SUPABASE_ANON_KEY!
const email = (process.env.MASTER_ADMIN_EMAIL ?? 'maestro@prodemundial.prode').trim()
const pwd = (process.env.MASTER_ADMIN_DNI ?? '47000001').replace(/\D/g, '')

const opts = { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } }

const c = createClient(url, anon, opts)
const { data: si } = await c.auth.signInWithPassword({ email, password: pwd })
if (!si.session) throw new Error('sign in failed')

const ac = createClient(url, anon, {
  ...opts,
  global: { headers: { Authorization: `Bearer ${si.session.access_token}` } },
})

for (const rpc of ['admin_get_scoring_center', 'admin_get_system_health', 'admin_get_analytics_overview', 'admin_get_beta_overview']) {
  const { data, error } = await ac.rpc(rpc)
  if (error) console.log(rpc, 'FAIL', error.message)
  else {
    const summary = rpc === 'admin_get_beta_overview'
      ? `${(data as { registered_users: number }).registered_users} users`
      : rpc === 'admin_get_scoring_center'
        ? `${(data as { matches: unknown[] }).matches?.length ?? 0} matches`
        : rpc === 'admin_get_system_health'
          ? `${(data as { services: unknown[] }).services?.length ?? 0} services`
          : 'ok'
    console.log(rpc, 'OK', summary)
  }
}
