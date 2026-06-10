/**
 * Tests: bloqueo scoring prematuro en admin_score_match
 * npm run test:premature-scoring-block
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

type Step = { name: string; ok: boolean; detail?: string }
const steps: Step[] = []
const pass = (n: string, d?: string) => { steps.push({ name: n, ok: true, detail: d }); console.log(`✔ ${n}${d ? ` — ${d}` : ''}`) }
const fail = (n: string, d?: string) => { steps.push({ name: n, ok: false, detail: d }); console.error(`✘ ${n}${d ? ` — ${d}` : ''}`) }

const service = createClient(url, serviceKey, opts)
const adminEmail = (process.env.MASTER_ADMIN_EMAIL ?? 'maestro@prodemundial.prode').trim()
const adminPwd = (process.env.MASTER_ADMIN_DNI ?? '47000001').replace(/\D/g, '')

const { data: si } = await createClient(url, anon, opts).auth.signInWithPassword({ email: adminEmail, password: adminPwd })
if (!si.session) { console.error('Admin sign-in failed'); process.exit(1) }

const admin = createClient(url, anon, {
  ...opts,
  global: { headers: { Authorization: `Bearer ${si.session.access_token}` } },
})

const { data: scheduled } = await service
  .from('matches')
  .select('id')
  .eq('status', 'scheduled')
  .gt('kick_off', new Date().toISOString())
  .limit(1)

const matchId = scheduled?.[0]?.id
if (!matchId) { fail('find_scheduled_match', 'sin partido scheduled'); process.exit(1) }
pass('find_scheduled_match', matchId)

const testEmail = `score-block-${Date.now()}@loadtest.prodemundial.test`
const { data: created } = await service.auth.admin.createUser({
  email: testEmail,
  password: `Block!${Date.now()}`,
  email_confirm: true,
})
const userId = created.user!.id
await service.from('profiles').upsert({ id: userId, email: testEmail, full_name: 'Score Block Test', role: 'member', is_active: true })

const { data: pred, error: predErr } = await service.from('predictions').insert({
  user_id: userId,
  match_id: matchId,
  predicted_score_home: 1,
  predicted_score_away: 0,
  predicted_winner: 'home',
  status: 'pending',
}).select('id').single()

if (predErr) { fail('create_prediction', predErr.message); process.exit(1) }
pass('create_prediction', pred!.id)

const { count: lbBefore } = await service.from('leaderboard').select('*', { count: 'exact', head: true }).eq('user_id', userId)

const { error: blockErr } = await admin.rpc('admin_score_match', { p_match_id: matchId })
if (blockErr?.message?.includes('match_not_finished')) {
  pass('admin_score_match_blocked', blockErr.message)
} else {
  fail('admin_score_match_blocked', blockErr?.message ?? 'no bloqueó')
}

const { data: predAfter } = await service.from('predictions').select('status,points').eq('id', pred!.id).single()
if (predAfter?.status === 'pending' && (predAfter.points ?? 0) === 0) {
  pass('prediction_stays_pending')
} else {
  fail('prediction_stays_pending', JSON.stringify(predAfter))
}

const { count: lbAfter } = await service.from('leaderboard').select('*', { count: 'exact', head: true }).eq('user_id', userId)
if ((lbAfter ?? 0) === (lbBefore ?? 0)) {
  pass('leaderboard_unchanged')
} else {
  fail('leaderboard_unchanged', `${lbBefore} → ${lbAfter}`)
}

const { error: finErr } = await service.from('matches').update({
  status: 'finished',
  score_home: 1,
  score_away: 0,
}).eq('id', matchId)

if (finErr) { fail('set_match_finished', finErr.message) }
else pass('set_match_finished')

const { data: scoreOk, error: scoreErr } = await admin.rpc('admin_score_match', { p_match_id: matchId })
if (scoreErr) {
  fail('admin_score_match_finished', scoreErr.message)
} else {
  pass('admin_score_match_finished', `scored=${(scoreOk as { predictions_scored?: number })?.predictions_scored}`)
}

const { data: predScored } = await service.from('predictions').select('status,points').eq('id', pred!.id).single()
if (predScored?.status === 'scored' && (predScored.points ?? 0) >= 0) {
  pass('prediction_scored_after_finished', `points=${predScored.points}`)
} else {
  fail('prediction_scored_after_finished', JSON.stringify(predScored))
}

await service.from('matches').update({ status: 'scheduled', score_home: null, score_away: null, scored_at: null }).eq('id', matchId)
await service.from('predictions').delete().eq('id', pred!.id)
await service.auth.admin.deleteUser(userId)

const report = { steps, summary: { passed: steps.filter(s => s.ok).length, failed: steps.filter(s => !s.ok).length } }
const outDir = join(process.cwd(), 'reports')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'premature-scoring-block-tests.json'), JSON.stringify(report, null, 2))

console.log(`\n${report.summary.passed}/${steps.length} OK`)
if (report.summary.failed > 0) process.exit(1)
