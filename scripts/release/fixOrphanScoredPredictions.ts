/**
 * Corrige predicciones scored en partidos no finalizados y recalcula leaderboard.
 * NO modifica score_match_predictions ni save_prediction.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!
const anon = process.env.VITE_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const opts = { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } }

const service = createClient(url, serviceKey, opts)

const { data: orphans } = await service
  .from('predictions')
  .select('id,user_id,match_id,points,status')
  .eq('status', 'scored')

const { data: matches } = await service.from('matches').select('id,status')
const finishedIds = new Set((matches ?? []).filter(m => m.status === 'finished').map(m => m.id))

const toFix = (orphans ?? []).filter(p => !finishedIds.has(p.match_id))
if (!toFix.length) {
  console.log('Nada que corregir')
  process.exit(0)
}

console.log(`Corrigiendo ${toFix.length} predicciones huérfanas...`)

const { error: updErr } = await service
  .from('predictions')
  .update({ status: 'pending', points: 0, scored_at: null })
  .in('id', toFix.map(p => p.id))

if (updErr) throw updErr

const affectedUsers = [...new Set(toFix.map(p => p.user_id))]
for (const userId of affectedUsers) {
  const { data: validPts } = await service
    .from('predictions')
    .select('points, match_id, status')
    .eq('user_id', userId)
    .eq('status', 'scored')

  const sum = (validPts ?? [])
    .filter(p => finishedIds.has(p.match_id))
    .reduce((acc, p) => acc + (p.points ?? 0), 0)

  if (sum === 0) {
    await service.from('leaderboard').delete().eq('user_id', userId).eq('period', 'global')
  } else {
    await service.from('leaderboard').update({ points: sum, wins: 0, draws: 0, losses: 0 }).eq('user_id', userId).eq('period', 'global')
  }
}

const adminEmail = (process.env.MASTER_ADMIN_EMAIL ?? 'maestro@prodemundial.prode').trim()
const adminPwd = (process.env.MASTER_ADMIN_DNI ?? '47000001').replace(/\D/g, '')
const signIn = createClient(url, anon, opts)
const { data: si } = await signIn.auth.signInWithPassword({ email: adminEmail, password: adminPwd })
if (si.session) {
  const ac = createClient(url, anon, {
    ...opts,
    global: { headers: { Authorization: `Bearer ${si.session.access_token}` } },
  })
  await ac.rpc('admin_recalculate_leaderboard')
}

const { data: lbAfter } = await service
  .from('leaderboard')
  .select('user_id,points,rank')
  .eq('period', 'global')
  .gt('points', 0)

const report = {
  fixed_at: new Date().toISOString(),
  predictions_reset: toFix.map(p => ({ id: p.id, user_id: p.user_id, was_points: p.points })),
  leaderboard_with_points_after: lbAfter,
}

const outDir = join(process.cwd(), 'reports')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'orphan-points-fix.json'), JSON.stringify(report, null, 2))

console.log('Predicciones reseteadas a pending')
console.log('Leaderboard con puntos después:', lbAfter?.length ?? 0)
if (lbAfter?.length) console.log(lbAfter)
else console.log('Ranking vacío — correcto hasta que se jueguen partidos')
