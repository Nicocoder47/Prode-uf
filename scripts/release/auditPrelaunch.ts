/**
 * Auditorías pre-lanzamiento: ranking, wins/draws/losses, predicciones huérfanas, capacidad.
 * npm run release:prelaunch-audit
 */
import { writeFileSync, mkdirSync } from 'node:fs'
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

async function main() {
  if (!url || !serviceKey || !anonKey) {
    console.error('Faltan variables cloud')
    process.exit(1)
  }

  const service = createClient(url, serviceKey, opts)
  const anon = createClient(url, anonKey, opts)
  const report: Record<string, unknown> = { generated_at: new Date().toISOString() }

  // --- Fase 5: Leaderboard audit ---
  const { data: lbRows } = await service
    .from('leaderboard')
    .select('user_id,rank,points,wins,draws,losses,updated_at')
    .eq('period', 'global')
    .order('points', { ascending: false })

  const dbRanks = (lbRows ?? []).map(r => ({ userId: r.user_id, rank: r.rank, points: r.points }))
  const activeFiltered = [...(lbRows ?? [])]
    .filter(r => (r.points ?? 0) > 0)
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .map((r, i) => ({ userId: r.user_id, rank: i + 1, points: r.points, dbRank: r.rank }))

  const rankMismatches = activeFiltered.filter(r => r.rank !== r.dbRank)
  const dupDbRanks = (lbRows ?? []).map(r => r.rank).filter((v, i, a) => a.indexOf(v) !== i)

  report.leaderboard_audit = {
    total_entries: lbRows?.length ?? 0,
    active_with_points: activeFiltered.length,
    rank_mismatches_after_filter: rankMismatches.length,
    rank_mismatch_samples: rankMismatches.slice(0, 10),
    duplicate_db_ranks: [...new Set(dupDbRanks)],
    frontend_backend_aligned: rankMismatches.length === 0 && dupDbRanks.length === 0,
  }

  // --- Fase 6: wins/draws/losses semantics ---
  report.wins_draws_losses_audit = {
    db_semantics: 'Incrementa por resultado REAL del partido (home/draw/away) al puntuar — NO aciertos del usuario',
    ui_issue: 'LeaderboardPage usa lb.wins como streak — semántica incorrecta en visualización',
    sample: (lbRows ?? []).slice(0, 5).map(r => ({
      user_id: r.user_id,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
      points: r.points,
    })),
  }

  // --- Fase 7: Orphan scored predictions ---
  const { data: orphanPreds } = await service
    .from('predictions')
    .select('id,user_id,match_id,status,points,scored_at')
    .eq('status', 'scored')

  const { data: matches } = await service.from('matches').select('id,status,score_home,score_away')
  const matchMap = new Map((matches ?? []).map(m => [m.id, m]))

  const orphans = (orphanPreds ?? []).filter(p => {
    const m = matchMap.get(p.match_id)
    return !m || m.status !== 'finished'
  })

  const testOrphans = orphans.filter(p => {
    return true // will enrich with profile email
  })

  const orphanDetails = []
  for (const p of orphans) {
    const { data: prof } = await service.from('profiles').select('email').eq('id', p.user_id).maybeSingle()
    orphanDetails.push({
      prediction_id: p.id,
      user_id: p.user_id,
      email: prof?.email ?? null,
      match_id: p.match_id,
      match_status: matchMap.get(p.match_id)?.status ?? 'missing',
      points: p.points,
      is_test_user: prof?.email ? /test|demo|fake|load|e2e|@prodemundial\.test/i.test(prof.email) : false,
    })
  }

  report.orphan_predictions = {
    total_scored: orphanPreds?.length ?? 0,
    orphans_not_finished: orphans.length,
    details: orphanDetails,
    test_only: orphanDetails.filter(o => o.is_test_user),
  }

  // Fix test orphans only
  const testOrphanIds = orphanDetails.filter(o => o.is_test_user).map(o => o.prediction_id)
  let fixed = 0
  if (testOrphanIds.length > 0) {
    const { error } = await service.from('predictions').delete().in('id', testOrphanIds)
    if (!error) fixed = testOrphanIds.length
  }
  report.orphan_fix = { test_orphans_deleted: fixed, ids: testOrphanIds }

  // --- Fase 9: Capacity probes ---
  const probes = [200, 400, 700, 1000]
  const { count: userCount } = await service.from('profiles').select('*', { count: 'exact', head: true }).is('deleted_at', null)
  const { count: predCount } = await service.from('predictions').select('*', { count: 'exact', head: true })

  const t0 = performance.now()
  await anon.from('leaderboard').select('user_id,rank,points').eq('period', 'global').order('points', { ascending: false }).limit(50)
  const lbMs = Math.round(performance.now() - t0)

  const t1 = performance.now()
  await service.from('matches').select('id,status').limit(100)
  const matchMs = Math.round(performance.now() - t1)

  report.capacity_estimate = {
    current_users: userCount,
    current_predictions: predCount,
    leaderboard_query_ms: lbMs,
    matches_query_ms: matchMs,
    scenarios: probes.map(n => ({
      users: n,
      est_predictions: Math.round(n * ((predCount ?? 0) / Math.max(1, userCount ?? 1))),
      risk: n <= 400 ? 'green' : n <= 700 ? 'yellow' : 'red',
    })),
  }

  // Beta overview
  const adminEmail = (process.env.MASTER_ADMIN_EMAIL ?? 'maestro@prodemundial.prode').trim().toLowerCase()
  const adminPwd = (process.env.MASTER_ADMIN_DNI ?? '47000001').replace(/\D/g, '')
  const { data: si } = await anon.auth.signInWithPassword({ email: adminEmail, password: adminPwd })
  if (si.session) {
    const ac = createClient(url, anonKey, {
      ...opts,
      global: { headers: { Authorization: `Bearer ${si.session.access_token}` } },
    })
    const { data: ov } = await ac.rpc('admin_get_beta_overview')
    report.beta_overview = ov
  }

  const outDir = join(process.cwd(), 'reports')
  mkdirSync(outDir, { recursive: true })
  const path = join(outDir, 'prelaunch-audit.json')
  writeFileSync(path, JSON.stringify(report, null, 2))

  console.log('=== PRE-LAUNCH AUDIT ===')
  console.log('Leaderboard aligned:', (report.leaderboard_audit as { frontend_backend_aligned: boolean }).frontend_backend_aligned)
  console.log('Orphan scored (not finished):', orphans.length, '| test fixed:', fixed)
  console.log('Leaderboard query:', lbMs, 'ms')
  console.log('Report:', path)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
