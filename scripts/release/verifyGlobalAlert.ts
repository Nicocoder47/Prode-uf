import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL?.replace(/\/$/, '')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.cloud')
  process.exit(1)
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}

const adminRes = await fetch(`${url}/rest/v1/rpc/admin_get_global_alert`, {
  method: 'POST',
  headers,
  body: '{}',
})
const adminBody = await adminRes.text()
console.log('admin_get_global_alert:', adminRes.status, adminBody)

const tableRes = await fetch(`${url}/rest/v1/global_app_alert?select=*`, { headers })
const tableBody = await tableRes.text()
console.log('global_app_alert table:', tableRes.status, tableBody)
