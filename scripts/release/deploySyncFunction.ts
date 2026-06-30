import { loadCloudEnv } from '../lib/loadCloudEnv.js'
import { execSync } from 'node:child_process'

loadCloudEnv()

const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm'
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

process.env.SUPABASE_ACCESS_TOKEN = token

console.log('Deploy sync-today-results...')
execSync(`npx supabase functions deploy sync-today-results --project-ref ${ref}`, {
  stdio: 'inherit',
  env: process.env,
})

console.log('OK')
