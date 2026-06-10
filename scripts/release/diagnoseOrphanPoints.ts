/**
 * Diagnóstico: puntos en ranking sin partidos finalizados
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const opts = { auth: { persistSession: false }, realtime: { transport: ws as unknown as typeof WebSocket } }

const service = createClient(url, serviceKey, opts)

const { data: preds } = await service
  .from('predictions')
  .select('id,user_id,match_id,status,points,predicted_score_home,predicted_score_away,scored_at,created_at')
  .eq('status', 'scored')

const { data: matches } = await service.from('matches').select('id,status,score_home,score_away,kick_off,scored_at,home_team_id,away_team_id')
const matchMap = new Map((matches ?? []).map(m => [m.id, m]))

const { data: lb } = await service
  .from('leaderboard')
  .select('user_id,rank,points,wins,draws,losses')
  .eq('period', 'global')
  .gt('points', 0)
  .order('points', { ascending: false })

const orphans = []
for (const p of preds ?? []) {
  const m = matchMap.get(p.match_id)
  if (!m || m.status !== 'finished') {
    const { data: prof } = await service.from('profiles').select('full_name,legajo,email').eq('id', p.user_id).single()
    const { data: ht } = m?.home_team_id ? await service.from('teams').select('name').eq('id', m.home_team_id).maybeSingle() : { data: null }
    const { data: at } = m?.away_team_id ? await service.from('teams').select('name').eq('id', m.away_team_id).maybeSingle() : { data: null }
    orphans.push({
      prediction_id: p.id,
      user: prof,
      points: p.points,
      match_id: p.match_id,
      match_status: m?.status ?? 'missing',
      match_score: m ? `${m.score_home ?? '?'}-${m.score_away ?? '?'}` : null,
      kick_off: m?.kick_off,
      teams: m ? `${ht?.name ?? '?'} vs ${at?.name ?? '?'}` : null,
      predicted: `${p.predicted_score_home}-${p.predicted_score_away}`,
      scored_at: p.scored_at,
    })
  }
}

const lbEnriched = []
for (const row of lb ?? []) {
  const { data: prof } = await service.from('profiles').select('full_name,legajo,email').eq('id', row.user_id).single()
  lbEnriched.push({ ...row, ...prof })
}

const { count: finishedCount } = await service
  .from('matches')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'finished')

const report = {
  generated_at: new Date().toISOString(),
  finished_matches: finishedCount,
  leaderboard_with_points: lbEnriched,
  orphan_scored_predictions: orphans,
  root_cause:
    'Predicciones marcadas status=scored con puntos asignados en partidos que NO están finished (scoring ejecutado antes de tiempo — E2E/manual)',
}

const outDir = join(process.cwd(), 'reports')
mkdirSync(outDir, { recursive: true })
const path = join(outDir, 'orphan-points-diagnosis.json')
writeFileSync(path, JSON.stringify(report, null, 2))

console.log('Partidos finalizados en DB:', finishedCount)
console.log('Leaderboard con puntos:', lbEnriched.length)
for (const u of lbEnriched) {
  console.log(`  ${u.full_name} (legajo ${u.legajo}) → ${u.points} pts`)
}
console.log('\nPredicciones scored en partidos NO finalizados:', orphans.length)
for (const o of orphans) {
  console.log(`  ${o.user?.full_name} → ${o.points} pts | partido ${o.teams} | status=${o.match_status} | predicho ${o.predicted}`)
}
console.log('\nReporte:', path)
