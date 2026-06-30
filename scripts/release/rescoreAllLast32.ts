/**
 * Repuntúa todos los LAST_32 finalizados y reconstruye leaderboard.
 * npx tsx scripts/release/rescoreAllLast32.ts
 */
import { loadCloudEnv } from '../lib/loadCloudEnv.js'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

loadCloudEnv()

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

async function main() {
  const { data: matches } = await sb
    .from('matches')
    .select('id,score_home,score_away,scored_at,home_team_id,away_team_id,phase,status')
    .eq('phase', 'LAST_32')
    .eq('status', 'finished')
    .not('scored_at', 'is', null)

  const { data: teams } = await sb.from('teams').select('id,code')
  const teamMap = new Map((teams ?? []).map(t => [t.id, t.code]))

  let total = 0
  for (const m of matches ?? []) {
    const label = `${teamMap.get(m.home_team_id) ?? '?'} vs ${teamMap.get(m.away_team_id) ?? '?'}`
    const { data, error } = await sb.rpc('rescore_match_predictions', {
      p_match_id: m.id,
      p_old_score_home: m.score_home,
      p_old_score_away: m.score_away,
    })
    if (error) {
      console.error(`FAIL ${label}:`, error.message)
      continue
    }
    console.log(`✓ ${label} → ${data} predicciones repuntuadas`)
    total += data ?? 0
  }

  console.log(`\nTotal repuntuadas: ${total}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
