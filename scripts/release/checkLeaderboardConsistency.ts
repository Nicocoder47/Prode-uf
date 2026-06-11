/**
 * Verifica leaderboard.points vs SUM(predictions.points) WHERE status='scored'
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (.env.cloud o env)')
  process.exit(1)
}

const service = createClient(url, serviceKey, {
  auth: { persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const { data: profiles, error: profilesError } = await service
  .from('profiles')
  .select('id, email, full_name, legajo')

if (profilesError) throw profilesError

const { data: leaderboard, error: lbError } = await service
  .from('leaderboard')
  .select('user_id, points')
  .eq('period', 'global')

if (lbError) throw lbError

const { data: predictions, error: predError } = await service
  .from('predictions')
  .select('user_id, points, status')
  .eq('status', 'scored')

if (predError) throw predError

const lbMap = new Map((leaderboard ?? []).map(r => [r.user_id as string, Number(r.points ?? 0)]))
const sumByUser = new Map<string, number>()

for (const p of predictions ?? []) {
  const uid = p.user_id as string
  sumByUser.set(uid, (sumByUser.get(uid) ?? 0) + Number(p.points ?? 0))
}

const mismatches: Record<string, unknown>[] = []
const profileMap = new Map((profiles ?? []).map(p => [p.id as string, p]))

const allUserIds = new Set([...lbMap.keys(), ...sumByUser.keys()])

for (const userId of allUserIds) {
  const lbPoints = lbMap.get(userId) ?? 0
  const sumPoints = sumByUser.get(userId) ?? 0
  if (lbPoints !== sumPoints) {
    const prof = profileMap.get(userId)
    mismatches.push({
      user_id: userId,
      email: prof?.email ?? null,
      full_name: prof?.full_name ?? null,
      legajo: prof?.legajo ?? null,
      leaderboard_points: lbPoints,
      sum_prediction_points: sumPoints,
      delta: lbPoints - sumPoints,
    })
  }
}

const report = {
  generated_at: new Date().toISOString(),
  users_checked: allUserIds.size,
  mismatch_count: mismatches.length,
  consistent: mismatches.length === 0,
  mismatches,
}

const outDir = join(process.cwd(), 'reports')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'leaderboard-consistency.json')
writeFileSync(outPath, JSON.stringify(report, null, 2))

console.log('Usuarios verificados:', allUserIds.size)
console.log('Discrepancias:', mismatches.length)
console.log('Consistente (0 filas):', mismatches.length === 0 ? 'SÍ' : 'NO')
if (mismatches.length > 0) {
  console.log(JSON.stringify(mismatches.slice(0, 10), null, 2))
}
console.log('Reporte:', outPath)

process.exit(mismatches.length === 0 ? 0 : 2)
