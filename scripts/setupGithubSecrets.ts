/**
 * Configura GitHub Actions secrets desde .env.cloud
 * npm run setup:github-secrets
 *
 * Requiere: gh auth login
 */
import { spawnSync } from 'node:child_process'
import { loadCloudEnv } from './lib/loadCloudEnv.js'

loadCloudEnv()

const secrets: Record<string, string | undefined> = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  FOOTBALL_DATA_API_KEY: process.env.FOOTBALL_DATA_API_KEY,
  API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY,
}

function setSecret(name: string, value: string) {
  console.log(`▶ gh secret set ${name}`)
  const result = spawnSync('gh', ['secret', 'set', name, '--body', value], {
    stdio: 'inherit',
    shell: true,
  })
  if (result.status !== 0) {
    throw new Error(`gh secret set ${name} falló`)
  }
}

async function main() {
  const missing = Object.entries(secrets).filter(([k, v]) => !v?.trim() && k !== 'API_FOOTBALL_KEY')
  if (missing.length) {
    console.error('Faltan en .env.cloud:', missing.map(([k]) => k).join(', '))
    process.exit(1)
  }

  for (const [name, value] of Object.entries(secrets)) {
    if (!value?.trim()) continue
    setSecret(name, value.trim())
  }

  console.log('\n✓ GitHub secrets configurados')
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
