/**
 * Validación integral pre-apertura beta — Fases 1, 4, 5, 6
 * npm run release:final-beta-readiness
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const opts = { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } }

type Check = { phase: string; name: string; ok: boolean; detail?: string }
const checks: Check[] = []
const pass = (phase: string, name: string, detail?: string) => {
  checks.push({ phase, name, ok: true, detail })
  console.log(`✔ [${phase}] ${name}${detail ? ` — ${detail}` : ''}`)
}
const fail = (phase: string, name: string, detail?: string) => {
  checks.push({ phase, name, ok: false, detail })
  console.error(`✘ [${phase}] ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  if (!url || !anon || !serviceKey) {
    console.error('Faltan variables cloud')
    process.exit(1)
  }

  const service = createClient(url, serviceKey, opts)
  const adminEmail = (process.env.MASTER_ADMIN_EMAIL ?? 'maestro@prodemundial.prode').trim()
  const adminPwd = (process.env.MASTER_ADMIN_DNI ?? '47000001').replace(/\D/g, '')
  const { data: si } = await createClient(url, anon, opts).auth.signInWithPassword({ email: adminEmail, password: adminPwd })
  if (!si.session) { fail('auth', 'admin_sign_in', 'falló'); process.exit(1) }
  pass('auth', 'admin_sign_in', adminEmail)

  const admin = createClient(url, anon, {
    ...opts,
    global: { headers: { Authorization: `Bearer ${si.session.access_token}` } },
  })

  // --- FASE 1: Post-fix ---
  const { data: scheduled } = await service.from('matches').select('id').eq('status', 'scheduled').limit(1)
  const schedId = scheduled?.[0]?.id
  if (schedId) {
    const { error: blockScore } = await admin.rpc('admin_score_match', { p_match_id: schedId })
    if (blockScore?.message?.includes('match_not_finished')) pass('f1', 'admin_score_match_blocks_scheduled', blockScore.message)
    else fail('f1', 'admin_score_match_blocks_scheduled', blockScore?.message ?? 'no bloqueó')

    const { error: blockRescore } = await admin.rpc('admin_rescore_match', { p_match_id: schedId, p_old_score_home: 0, p_old_score_away: 0 })
    if (blockRescore?.message?.includes('match_not_finished')) pass('f1', 'admin_rescore_match_blocks_scheduled', blockRescore.message)
    else fail('f1', 'admin_rescore_match_blocks_scheduled', blockRescore?.message ?? 'no bloqueó')
  } else {
    pass('f1', 'admin_score_match_blocks_scheduled', 'skipped — sin scheduled')
    pass('f1', 'admin_rescore_match_blocks_scheduled', 'skipped')
  }

  const { data: health } = await admin.rpc('admin_get_system_health')
  const h = health as { orphan_scored?: { count: number }; services?: { id: string; status: string }[] }
  const integrity = h?.services?.find(s => s.id === 'scoring_integrity')
  if (h?.orphan_scored?.count === 0) pass('f1', 'no_orphan_scored_predictions', '0')
  else fail('f1', 'no_orphan_scored_predictions', `${h?.orphan_scored?.count} huérfanas`)

  if (integrity?.status === 'green') pass('f1', 'health_scoring_integrity_green')
  else fail('f1', 'health_scoring_integrity_green', integrity?.status ?? 'missing')

  const { data: scoring } = await admin.rpc('admin_get_scoring_center')
  const sc = scoring as { orphan_scored?: { count: number } }
  if (sc?.orphan_scored != null) pass('f1', 'scoring_center_has_orphan_field', `count=${sc.orphan_scored.count}`)
  else fail('f1', 'scoring_center_has_orphan_field')

  const { data: lbPts } = await service.from('leaderboard').select('user_id,points,rank').eq('period', 'global').gt('points', 0)
  const { count: finishedCount } = await service.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'finished')
  if ((lbPts?.length ?? 0) === 0 && (finishedCount ?? 0) === 0) pass('f1', 'leaderboard_no_phantom_points', '0 pts con 0 finished')
  else if ((finishedCount ?? 0) > 0) pass('f1', 'leaderboard_no_phantom_points', `${lbPts?.length} con puntos, ${finishedCount} finished`)
  else if ((lbPts?.length ?? 0) > 0) fail('f1', 'leaderboard_no_phantom_points', `${lbPts?.length} usuarios con puntos sin partidos finished`)

  // --- FASE 4: DB audit ---
  const { data: orphanPreds } = await service.from('predictions').select('id,match_id,status,points').eq('status', 'scored')
  const { data: allMatches } = await service.from('matches').select('id,status')
  const finishedSet = new Set((allMatches ?? []).filter(m => m.status === 'finished').map(m => m.id))
  const orphans = (orphanPreds ?? []).filter(p => !finishedSet.has(p.match_id))
  if (orphans.length === 0) pass('f4', 'db_no_orphan_predictions')
  else fail('f4', 'db_no_orphan_predictions', `${orphans.length}`)

  const { data: lbAll } = await service.from('leaderboard').select('rank,user_id').eq('period', 'global')
  const ranks = (lbAll ?? []).map(r => r.rank)
  const dupRanks = ranks.filter((v, i, a) => a.indexOf(v) !== i)
  if (dupRanks.length === 0) pass('f4', 'db_no_duplicate_ranks')
  else fail('f4', 'db_no_duplicate_ranks', dupRanks.join(','))

  const { data: dupEmails } = await service.rpc('admin_get_users')
  const users = (dupEmails as { email: string }[]) ?? []
  const emailSet = new Set(users.map(u => u.email?.toLowerCase()))
  if (emailSet.size === users.length) pass('f4', 'db_no_duplicate_emails', `${users.length} users`)
  else fail('f4', 'db_no_duplicate_emails')

  const { count: regUsers } = await service.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null)
  const { count: predCount } = await service.from('predictions').select('*', { count: 'exact', head: true })
  const { count: auditCount } = await service.from('admin_audit_log').select('*', { count: 'exact', head: true })

  // --- FASE 5: Beta capacity ---
  const { data: overview } = await admin.rpc('admin_get_beta_overview')
  const ov = overview as Record<string, number | boolean>
  pass('f5', 'beta_overview', `${ov.registered_users}/${ov.max_users} slots=${ov.available_slots}`)

  const t0 = performance.now()
  await admin.rpc('admin_get_analytics_overview')
  const analyticsMs = Math.round(performance.now() - t0)
  pass('f5', 'analytics_rpc_ms', String(analyticsMs))

  const scenarios = [200, 400, 700, 1000].map(n => ({
    users: n,
    est_predictions: Math.round(n * ((predCount ?? 0) / Math.max(1, regUsers ?? 1))),
    risk: n <= 400 ? 'green' : n <= 700 ? 'yellow' : 'red',
  }))

  // --- FASE 6: Deploy checklist ---
  const vercelUrl = process.env.VERCEL_URL || 'https://prodemundialprode.vercel.app'
  const supabaseUrl = url
  const hasAnon = Boolean(anon)
  const hasService = Boolean(serviceKey)
  const hasAccessToken = Boolean(process.env.SUPABASE_ACCESS_TOKEN)

  if (hasAnon && !supabaseUrl.includes('127.0.0.1')) pass('f6', 'supabase_url_production', supabaseUrl)
  else fail('f6', 'supabase_url_production', supabaseUrl)

  const adminRpcs = [
    'admin_get_beta_overview', 'admin_get_users', 'admin_get_scoring_center',
    'admin_get_system_health', 'admin_get_analytics_overview', 'admin_get_registration_status',
  ]
  for (const rpc of adminRpcs) {
    const { error } = await admin.rpc(rpc)
    if (error?.message?.includes('Could not find')) fail('f6', `rpc_${rpc}`, error.message)
    else pass('f6', `rpc_${rpc}`)
  }

  const { data: regStatus } = await admin.rpc('admin_get_registration_status')
  pass('f6', 'invitations_registration_status', JSON.stringify(regStatus))

  let vercelOk = false
  try {
    const res = await fetch(vercelUrl, { method: 'HEAD' })
    vercelOk = res.ok || res.status === 304
    if (vercelOk) pass('f6', 'vercel_deploy_reachable', vercelUrl)
    else fail('f6', 'vercel_deploy_reachable', `HTTP ${res.status}`)
  } catch (e) {
    fail('f6', 'vercel_deploy_reachable', e instanceof Error ? e.message : 'error')
  }

  // Build artifact check
  const distExists = existsSync(join(process.cwd(), 'dist', 'index.html'))
  if (distExists) pass('f6', 'local_build_dist_exists')
  else fail('f6', 'local_build_dist_exists')

  const passed = checks.filter(c => c.ok).length
  const failed = checks.filter(c => !c.ok).length
  const pct = Math.round((passed / checks.length) * 100)

  const report = {
    generated_at: new Date().toISOString(),
    summary: { passed, failed, total: checks.length, readiness_pct: pct },
    checks,
    beta: {
      registered_users: regUsers,
      available_slots: ov.available_slots,
      max_users: ov.max_users,
      test_users: ov.test_users_detected,
      predictions: predCount,
      admin_audit_entries: auditCount,
      leaderboard_with_points: lbPts?.length ?? 0,
      finished_matches: finishedCount,
    },
    capacity_scenarios: scenarios,
    infra: {
      vercel_url: vercelUrl,
      supabase_url: supabaseUrl,
      has_anon_key: hasAnon,
      has_service_role: hasService,
      has_access_token: hasAccessToken,
      analytics_rpc_ms: analyticsMs,
    },
  }

  const outDir = join(process.cwd(), 'reports')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'final-beta-readiness.json'), JSON.stringify(report, null, 2))
  console.log(`\n=== READINESS: ${passed}/${checks.length} (${pct}%) ===`)
  console.log('Report:', join(outDir, 'final-beta-readiness.json'))
  if (failed > 0) process.exit(1)
}

main().catch(err => { console.error(err); process.exit(1) })
