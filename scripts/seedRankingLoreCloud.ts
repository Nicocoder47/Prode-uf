/**
 * Inserta las cards de lore del ranking en Supabase cloud (sin Postgres directo).
 * npm run db:seed:ranking-lore
 */
import { loadCloudEnv } from './lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL?.trim()?.replace(/\/$/, '')
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

const ROWS = [
  {
    key: 'ranking_lore_auto',
    title: 'Lore ranking automático',
    value: '1',
    subtitle: '2° puesto en vivo',
    description:
      'Si está activo, protagonista, distancia y párrafo salen del leaderboard (se renueva cada ~30 s).',
    icon: null,
    status: 'success',
    order_index: 109,
    is_active: true,
  },
  {
    key: 'ranking_lore_enabled',
    title: 'Lore ranking activo',
    value: '1',
    subtitle: 'Mundial en Vivo',
    description:
      'Si está activo, la card de ranking muestra el relato editorial en lugar del podio automático.',
    icon: null,
    status: 'success',
    order_index: 110,
    is_active: true,
  },
  {
    key: 'ranking_lore_emoji',
    title: 'Lore emoji',
    value: '🎯',
    subtitle: 'Icono del titular',
    description: null,
    icon: '🎯',
    status: 'neutral',
    order_index: 111,
    is_active: true,
  },
  {
    key: 'ranking_lore_headline',
    title: 'Lore titular',
    value: 'TIENE AL LÍDER EN LA MIRA',
    subtitle: 'Titular principal',
    description: null,
    icon: null,
    status: 'warning',
    order_index: 112,
    is_active: true,
  },
  {
    key: 'ranking_lore_subject',
    title: 'Lore protagonista',
    value: 'Marcelo Arguello',
    subtitle: 'Nombre destacado',
    description: null,
    icon: null,
    status: 'neutral',
    order_index: 113,
    is_active: true,
  },
  {
    key: 'ranking_lore_body',
    title: 'Lore cuerpo',
    value: null,
    subtitle: 'Párrafo narrativo',
    description:
      'Marcelo Arguello sigue de cerca la pelea por el primer puesto. La diferencia es mínima y un resultado exacto podría cambiar el ranking en cualquier momento.',
    icon: null,
    status: 'neutral',
    order_index: 114,
    is_active: true,
  },
  {
    key: 'ranking_lore_distance',
    title: 'Lore distancia (pts)',
    value: '0',
    subtitle: 'Distancia a la cima',
    description: null,
    icon: null,
    status: 'neutral',
    order_index: 115,
    is_active: true,
  },
  {
    key: 'ranking_lore_objective',
    title: 'Lore objetivo',
    value: 'superar al líder',
    subtitle: 'Próximo objetivo',
    description: null,
    icon: null,
    status: 'neutral',
    order_index: 116,
    is_active: true,
  },
] as const

function restHeaders() {
  return {
    apikey: serviceKey!,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }
}

async function main() {
  if (!url || !serviceKey) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.cloud')
    process.exit(1)
  }

  const keys = ROWS.map(row => row.key).join(',')
  const readRes = await fetch(`${url}/rest/v1/admin_cards?select=key&key=in.(${keys})`, {
    headers: restHeaders(),
  })
  const readBody = await readRes.text()
  if (!readRes.ok) {
    console.error('Error leyendo admin_cards:', readRes.status, readBody.slice(0, 200))
    process.exit(1)
  }

  const existing = JSON.parse(readBody) as { key: string }[]
  const existingKeys = new Set(existing.map(row => row.key))
  const pending = ROWS.filter(row => !existingKeys.has(row.key))

  if (pending.length === 0) {
    console.log('✓ Lore ranking ya estaba aplicado en cloud (7/7 cards)')
    return
  }

  const insertRes = await fetch(`${url}/rest/v1/admin_cards`, {
    method: 'POST',
    headers: { ...restHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(pending),
  })
  const insertBody = await insertRes.text()
  if (!insertRes.ok) {
    console.error('Error insertando lore ranking:', insertRes.status, insertBody.slice(0, 300))
    process.exit(1)
  }

  console.log(`✓ Lore ranking aplicado en cloud (${pending.length} cards nuevas, ${existingKeys.size} ya existían)`)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
