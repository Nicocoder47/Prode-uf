/**
 * Fase 1 pre-lanzamiento: reporte detallado de usuarios test + cleanup opcional.
 *
 * Preview (sin eliminar):
 *   npm run release:test-users-report
 *
 * Ejecutar cleanup tras validación:
 *   npm run release:test-users-cleanup
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const opts = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
} as const

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = (process.env.MASTER_ADMIN_EMAIL ?? 'maestro@prodemundial.prode').trim().toLowerCase()
const adminPassword = (process.env.MASTER_ADMIN_DNI ?? '47000001').replace(/\D/g, '')

const runCleanup = process.argv.includes('--cleanup')

type TestUserRow = {
  id: string
  email: string
  full_name: string
  created_at: string
  last_login_at: string | null
  last_activity_at: string | null
  predictions_count: number
  total_points: number
}

function isTestEmail(email: string) {
  const e = email.toLowerCase()
  return (
    e.endsWith('@loadtest.prodemundial.test') ||
    e.endsWith('@prodemundial.test') ||
    /^(e2e-|score-audit-|score-bulk-|loadtest-)/.test(e) ||
    /(^|[^a-z])(test|demo|fake|loadtest)([^a-z]|@|$)/.test(e)
  )
}

async function buildReport(service: ReturnType<typeof createClient>) {
  const { data: profiles, error } = await service
    .from('profiles')
    .select('id,email,full_name,created_at,last_login_at,role,deleted_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  const testUsers = (profiles ?? []).filter(p => p.role !== 'admin' && isTestEmail(p.email ?? ''))
  const rows: TestUserRow[] = []

  for (const u of testUsers) {
    const [{ count: predCount }, { data: lastAct }, { data: lb }] = await Promise.all([
      service.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
      service
        .from('activity_logs')
        .select('created_at')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
        .limit(1),
      service.from('leaderboard').select('points').eq('user_id', u.id).eq('period', 'global').maybeSingle(),
    ])

    rows.push({
      id: u.id,
      email: u.email ?? '',
      full_name: u.full_name ?? '',
      created_at: u.created_at,
      last_login_at: u.last_login_at,
      last_activity_at: lastAct?.[0]?.created_at ?? null,
      predictions_count: predCount ?? 0,
      total_points: lb?.points ?? 0,
    })
  }

  return rows
}

async function main() {
  if (!url || !anonKey || !serviceKey) {
    console.error('Faltan variables cloud')
    process.exit(1)
  }

  const service = createClient(url, serviceKey, opts)
  const signInClient = createClient(url, anonKey, opts)
  const { data: signIn, error: signInErr } = await signInClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (signInErr || !signIn.session) {
    console.error('Admin sign-in falló:', signInErr?.message)
    process.exit(1)
  }

  const adminClient = createClient(url, anonKey, {
    ...opts,
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  })

  const { data: beforeOverview } = await adminClient.rpc('admin_get_beta_overview')
  const before = beforeOverview as {
    registered_users?: number
    test_users_detected?: number
    available_slots?: number
    max_users?: number
  }

  console.log('\n=== PREVIEW USUARIOS TEST ===\n')
  const rows = await buildReport(service)
  console.log(`Total detectados: ${rows.length}`)
  console.log('─'.repeat(100))
  for (const r of rows) {
    console.log(
      `${r.email.padEnd(45)} | alta: ${new Date(r.created_at).toLocaleDateString('es-AR')} | login: ${r.last_login_at ? new Date(r.last_login_at).toLocaleDateString('es-AR') : '—'} | act: ${r.last_activity_at ? new Date(r.last_activity_at).toLocaleDateString('es-AR') : '—'} | pred: ${r.predictions_count} | pts: ${r.total_points}`,
    )
  }
  console.log('─'.repeat(100))

  const outDir = join(process.cwd(), 'reports')
  mkdirSync(outDir, { recursive: true })
  const previewPath = join(outDir, 'test-users-cleanup-preview.json')
  writeFileSync(
    previewPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        count: rows.length,
        before_overview: before,
        users: rows,
      },
      null,
      2,
    ),
  )
  console.log(`\nPreview guardado: ${previewPath}`)

  if (!runCleanup) {
    console.log('\n⚠ NO se eliminó nada. Para cleanup: npm run release:test-users-cleanup')
    return
  }

  console.log('\n=== EJECUTANDO admin_cleanup_test_users ===\n')
  const { data: cleanup, error: cleanupErr } = await adminClient.rpc('admin_cleanup_test_users', {
    p_confirmation: 'LIMPIAR_TEST',
  })
  if (cleanupErr) {
    console.error('Cleanup falló:', cleanupErr.message)
    process.exit(1)
  }

  const { data: afterOverview } = await adminClient.rpc('admin_get_beta_overview')
  const after = afterOverview as typeof before

  const { data: audit } = await service
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: lb } = await service.from('leaderboard').select('user_id,rank,points').eq('period', 'global')
  const ranks = (lb ?? []).map(r => r.rank as number)
  const dupRanks = ranks.length !== new Set(ranks).size

  const deletedCount = (cleanup as { deleted_count?: number })?.deleted_count ?? 0
  const realRemaining = (after?.registered_users ?? 0) - (after?.test_users_detected ?? 0)

  const finalReport = {
    generated_at: new Date().toISOString(),
    deleted_count: deletedCount,
    before,
    after,
    real_users_remaining: realRemaining,
    slots_freed: (after?.available_slots ?? 0) - (before?.available_slots ?? 0),
    leaderboard_integrity: { entries: lb?.length ?? 0, duplicate_ranks: dupRanks },
    recent_audit: audit,
    cleanup_result: cleanup,
  }

  const finalPath = join(outDir, 'test-users-cleanup-final.json')
  writeFileSync(finalPath, JSON.stringify(finalReport, null, 2))

  console.log(`Usuarios eliminados: ${deletedCount}`)
  console.log(`Registrados: ${before?.registered_users} → ${after?.registered_users}`)
  console.log(`Test restantes: ${after?.test_users_detected}`)
  console.log(`Usuarios reales estimados: ${realRemaining}`)
  console.log(`Cupos disponibles: ${after?.available_slots}/${after?.max_users}`)
  console.log(`Leaderboard: ${lb?.length} entradas, ranks duplicados: ${dupRanks ? 'SÍ ⚠' : 'NO ✓'}`)
  console.log(`\nReporte final: ${finalPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
