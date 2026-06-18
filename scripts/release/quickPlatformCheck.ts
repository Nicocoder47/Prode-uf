import { writeFileSync, mkdirSync } from 'node:fs'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'
import { createClient } from '@supabase/supabase-js'

loadCloudEnv()

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const { data: matches } = await sb
  .from('matches')
  .select('id,status,score_home,score_away,scored_at,kick_off,home:home_team_id(code),away:away_team_id(code)')
  .order('kick_off')

const byStatus: Record<string, number> = {}
for (const m of matches ?? []) byStatus[m.status] = (byStatus[m.status] ?? 0) + 1

const finished = (matches ?? []).filter(m => m.status === 'finished')
const finishedRows = finished.map(m => ({
  match: `${(m.home as { code?: string })?.code ?? '?'} vs ${(m.away as { code?: string })?.code ?? '?'}`,
  score: `${m.score_home ?? '?'}-${m.score_away ?? '?'}`,
  scored_at: m.scored_at?.slice(0, 19) ?? null,
  kick_off: m.kick_off?.slice(0, 10) ?? null,
}))

const { count: scorerRows } = await sb
  .from('player_ratings')
  .select('*', { count: 'exact', head: true })
  .eq('source', 'football_data_tournament')

const report = {
  generated_at: new Date().toISOString(),
  match_counts: byStatus,
  finished_matches: finishedRows,
  finished_without_score: finished.filter(m => m.score_home == null || m.score_away == null).length,
  finished_without_scored_at: finished.filter(m => !m.scored_at).length,
  scorer_rows: scorerRows ?? 0,
}

mkdirSync('reports', { recursive: true })
writeFileSync('reports/platform-check.json', JSON.stringify(report, null, 2))

console.log(JSON.stringify(report, null, 2))
