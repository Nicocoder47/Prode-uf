/**
 * Tests de admin_delete_user_full y seguridad asociada.
 *
 * Requiere: .env.cloud con SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY
 *           MASTER_ADMIN_EMAIL / MASTER_ADMIN_DNI para sesión admin
 *
 * Uso: npm run test:admin-delete-user
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const clientOpts = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
} as const

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const adminEmail = (process.env.MASTER_ADMIN_EMAIL ?? 'maestro@prodemundial.prode').trim().toLowerCase()
const adminPassword = (process.env.MASTER_ADMIN_DNI ?? '47000001').replace(/\D/g, '')

type Step = { name: string; ok: boolean; detail?: string }
const steps: Step[] = []

function pass(name: string, detail?: string) {
  steps.push({ name, ok: true, detail })
  console.log(`✔ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name: string, detail?: string) {
  steps.push({ name, ok: false, detail })
  console.error(`✘ ${name}${detail ? ` — ${detail}` : ''}`)
}

function authedClient(token: string) {
  return createClient(url!, anonKey!, {
    ...clientOpts,
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

async function countInTable(service: ReturnType<typeof createClient>, table: string, userId: string) {
  const { count, error } = await service.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId)
  if (error) return -1
  return count ?? 0
}

async function getScheduledMatchId(service: ReturnType<typeof createClient>) {
  const { data, error } = await service
    .from('matches')
    .select('id')
    .eq('status', 'scheduled')
    .gt('kick_off', new Date().toISOString())
    .order('kick_off', { ascending: true })
    .limit(1)
  if (error) throw error
  return data?.[0]?.id as string | undefined
}

async function main() {
  if (!url || !serviceKey || !anonKey) {
    console.error('FAIL: faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_ANON_KEY')
    process.exit(1)
  }

  const service = createClient(url, serviceKey, clientOpts)
  const report: Record<string, unknown> = { started_at: new Date().toISOString() }

  // --- Admin session ---
  const signInClient = createClient(url, anonKey, clientOpts)
  const { data: signIn, error: signInErr } = await signInClient.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  if (signInErr || !signIn.session) {
    fail('admin_sign_in', signInErr?.message)
    process.exit(1)
  }
  pass('admin_sign_in', adminEmail)
  const adminToken = signIn.session.access_token
  const adminClient = authedClient(adminToken)
  const adminId = signIn.user!.id

  // --- RPC exists ---
  const { error: overviewErr } = await adminClient.rpc('admin_get_beta_overview')
  if (overviewErr?.message?.includes('Could not find the function')) {
    fail('migration_260_applied', 'Ejecutá npm run db:push:cloud')
    process.exit(1)
  }
  pass('migration_260_applied')

  const slotsBefore = await adminClient.rpc('admin_get_beta_overview')
  const registeredBefore = (slotsBefore.data as { registered_users?: number })?.registered_users ?? 0

  // --- Create test user with related data ---
  const testEmail = `admin-delete-test-${Date.now()}@loadtest.prodemundial.test`
  const testPassword = `TestDel!${Date.now()}`
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    fail('create_test_user', createErr?.message)
    process.exit(1)
  }
  const testUserId = created.user.id
  pass('create_test_user', testEmail)

  await service.from('profiles').upsert({
    id: testUserId,
    email: testEmail,
    full_name: 'Admin Delete Test',
    role: 'member',
    is_active: true,
  })

  const matchId = await getScheduledMatchId(service)
  if (matchId) {
    await service.from('predictions').insert({
      user_id: testUserId,
      match_id: matchId,
      predicted_score_home: 1,
      predicted_score_away: 0,
      predicted_winner: 'home',
      status: 'pending',
    })
    pass('create_prediction', matchId)
  } else {
    pass('create_prediction', 'skipped — sin partido scheduled')
  }

  await service.from('leaderboard').upsert({
    user_id: testUserId,
    period: 'global',
    points: 12,
    rank: 9999,
    wins: 1,
    draws: 0,
    losses: 0,
  })
  pass('create_leaderboard_entry')

  await service.from('activity_logs').insert({
    user_id: testUserId,
    type: 'user_login',
    title: 'Test login',
    description: 'Admin delete test',
  })
  pass('create_activity_log')

  // --- Member cannot delete ---
  const memberClient = createClient(url, anonKey, clientOpts)
  const { data: memberSignIn } = await memberClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })
  if (memberSignIn.session) {
    const memberAuthed = authedClient(memberSignIn.session.access_token)
    const { error: memberDeleteErr } = await memberAuthed.rpc('admin_delete_test_user', { p_user_id: testUserId })
    if (memberDeleteErr?.message?.includes('forbidden') || memberDeleteErr?.code === '42501') {
      pass('member_cannot_delete', memberDeleteErr.message)
    } else {
      fail('member_cannot_delete', memberDeleteErr?.message ?? 'RPC permitida para member')
    }
  } else {
    fail('member_sign_in', 'No se pudo iniciar sesión como test user')
  }

  // --- Admin delete test user ---
  const { data: deleteResult, error: deleteErr } = await adminClient.rpc('admin_delete_test_user', {
    p_user_id: testUserId,
  })
  if (deleteErr) {
    fail('admin_delete_test_user', deleteErr.message)
  } else {
    const r = deleteResult as { success?: boolean; freed_slot?: boolean; deleted_email?: string }
    if (r.success && r.freed_slot) {
      pass('admin_delete_test_user', r.deleted_email)
    } else {
      fail('admin_delete_test_user', JSON.stringify(deleteResult))
    }
  }

  // --- Verify cleanup ---
  const tables = ['profiles', 'predictions', 'leaderboard', 'activity_logs', 'device_reports', 'token_transactions']
  let allClean = true
  for (const table of tables) {
    const cnt = await countInTable(service, table, testUserId)
    if (cnt === -1) continue
    if (cnt > 0) {
      fail(`cleanup_${table}`, `${cnt} filas restantes`)
      allClean = false
    }
  }
  if (allClean) pass('all_tables_clean')

  const { data: authUser } = await service.auth.admin.getUserById(testUserId)
  if (!authUser.user) {
    pass('auth_user_removed')
  } else {
    fail('auth_user_removed', 'auth.users aún existe')
  }

  const slotsAfter = await adminClient.rpc('admin_get_beta_overview')
  const registeredAfter = (slotsAfter.data as { registered_users?: number })?.registered_users ?? 0
  if (registeredAfter <= registeredBefore) {
    pass('slot_freed', `${registeredBefore} → ${registeredAfter}`)
  } else {
    fail('slot_freed', `${registeredBefore} → ${registeredAfter}`)
  }

  // --- Leaderboard integrity ---
  const { data: lbRows, error: lbErr } = await service.from('leaderboard').select('user_id, rank').eq('period', 'global')
  if (lbErr) {
    fail('leaderboard_integrity', lbErr.message)
  } else {
    const ranks = (lbRows ?? []).map(r => r.rank as number).filter(n => n != null)
    const hasDupRank = ranks.length !== new Set(ranks).size
    if (!hasDupRank) {
      pass('leaderboard_no_duplicate_ranks', `${ranks.length} entradas`)
    } else {
      fail('leaderboard_no_duplicate_ranks')
    }
  }

  // --- Cannot delete last admin ---
  const { data: admins } = await service.from('profiles').select('id').eq('role', 'admin').is('deleted_at', null)
  if ((admins?.length ?? 0) === 1) {
    const onlyAdminId = admins![0].id
    const { error: lastAdminErr } = await adminClient.rpc('admin_delete_user_full', {
      p_user_id: onlyAdminId,
      p_reason: 'test',
      p_confirmation: 'ELIMINAR',
    })
    if (
      lastAdminErr?.message?.includes('cannot_hard_delete_admin') ||
      lastAdminErr?.message?.includes('cannot_delete_last_admin')
    ) {
      pass('cannot_delete_last_admin', lastAdminErr.message)
    } else {
      fail('cannot_delete_last_admin', lastAdminErr?.message ?? 'sin protección')
    }
  } else {
    pass('cannot_delete_last_admin', `skipped — ${admins?.length ?? 0} admins activos`)
  }

  // --- Cannot self-delete ---
  const { error: selfErr } = await adminClient.rpc('admin_delete_user_full', {
    p_user_id: adminId,
    p_reason: 'test',
    p_confirmation: 'ELIMINAR',
  })
  if (selfErr?.message?.includes('cannot_delete_self')) {
    pass('cannot_delete_self', selfErr.message)
  } else {
    fail('cannot_delete_self', selfErr?.message ?? 'sin protección')
  }

  const passed = steps.filter(s => s.ok).length
  const failed = steps.filter(s => !s.ok).length
  report.steps = steps
  report.summary = { passed, failed, total: steps.length }

  const outDir = join(process.cwd(), 'reports')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'admin-delete-user-tests.json'), JSON.stringify(report, null, 2))
  console.log(`\nResumen: ${passed}/${steps.length} OK`)
  console.log('Report: reports/admin-delete-user-tests.json')

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
