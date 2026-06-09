/**
 * Smoke test — user_support_tickets (requiere migración 20240121000000 aplicada).
 * npm run smoke:support
 */
import { loadCloudEnv } from './lib/loadCloudEnv.js'

loadCloudEnv()

const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm'
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const url = process.env.SUPABASE_URL?.trim()
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!token) {
  console.error('Falta SUPABASE_ACCESS_TOKEN para verificar tabla')
  process.exit(1)
}

async function runSql(query: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 800)}`)
  return body
}

async function main() {
  console.log('1) Verificando tabla user_support_tickets…')
  const tableCheck = await runSql(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_support_tickets'
    ORDER BY ordinal_position;
  `)
  if (!tableCheck.includes('user_id')) {
    throw new Error('Tabla user_support_tickets no encontrada. Aplicá la migración 20240121000000.')
  }
  console.log('   ✓ Tabla presente')

  if (!url || !serviceKey) {
    console.warn('2) Sin SUPABASE_URL/SERVICE_ROLE_KEY — smoke CRUD omitido (solo verificación de tabla).')
    console.log('\nSMOKE OK (schema)')
    return
  }

  const { createClient } = await import('@supabase/supabase-js')
  const ws = (await import('ws')).default
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  })

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .limit(1)
    .maybeSingle()

  if (profileErr || !profile?.id) {
    throw new Error(`No se pudo obtener perfil de prueba: ${profileErr?.message ?? 'sin filas'}`)
  }

  const subject = `[smoke] ${new Date().toISOString()}`
  console.log('2) Crear ticket…')
  const { data: created, error: createErr } = await admin
    .from('user_support_tickets')
    .insert({
      user_id: profile.id,
      category: 'otro',
      subject,
      message: 'Smoke test automatizado — ignorar',
      priority: 'normal',
    })
    .select('*')
    .single()

  if (createErr || !created) throw new Error(`Create failed: ${createErr?.message}`)

  console.log('3) Listar ticket…')
  const { data: listed, error: listErr } = await admin
    .from('user_support_tickets')
    .select('*')
    .eq('id', created.id)
    .single()
  if (listErr || !listed) throw new Error(`List failed: ${listErr?.message}`)

  console.log('4) Responder ticket…')
  const { error: respondErr } = await admin
    .from('user_support_tickets')
    .update({
      status: 'in_review',
      admin_response: 'Respuesta smoke test',
      updated_at: new Date().toISOString(),
    })
    .eq('id', created.id)
  if (respondErr) throw new Error(`Respond failed: ${respondErr.message}`)

  console.log('5) Resolver ticket…')
  const { error: resolveErr } = await admin
    .from('user_support_tickets')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', created.id)
  if (resolveErr) throw new Error(`Resolve failed: ${resolveErr.message}`)

  console.log('6) Cleanup…')
  await admin.from('user_support_tickets').delete().eq('id', created.id)

  console.log('\nSMOKE OK (CRUD)')
}

main().catch(err => {
  console.error('\nSMOKE FAIL:', err instanceof Error ? err.message : err)
  process.exit(1)
})
