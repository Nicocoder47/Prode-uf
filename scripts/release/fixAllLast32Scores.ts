/**
 * Audita y corrige marcadores LAST_32 (regularTime vs fullTime) + repuntúa.
 * npx tsx scripts/release/fixAllLast32Scores.ts
 * npx tsx scripts/release/fixAllLast32Scores.ts --fix
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

loadCloudEnv()

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const fdKey = process.env.FOOTBALL_DATA_API_KEY!
const fdBase = process.env.FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org/v4'
const doFix = process.argv.includes('--fix')

type FdScore = {
  regularTime?: { home?: number | null; away?: number | null }
  fullTime?: { home?: number | null; away?: number | null }
  extraTime?: { home?: number | null; away?: number | null }
  penalties?: { home?: number | null; away?: number | null }
}

type MatchRow = {
  id: string
  provider_match_id: string | null
  status: string
  score_home: number
  score_away: number
  score_home_after_et: number | null
  score_away_after_et: number | null
  score_home_penalties: number | null
  score_away_penalties: number | null
  scored_at: string | null
  home_team_id: string
  away_team_id: string
}

async function fetchFdScore(providerMatchId: string): Promise<FdScore | null> {
  await new Promise(r => setTimeout(r, 1600))
  const res = await fetch(`${fdBase}/matches/${providerMatchId}`, {
    headers: { 'X-Auth-Token': fdKey },
  })
  if (!res.ok) return null
  const raw = await res.json() as { score?: FdScore }
  return raw.score ?? null
}

function expectedFromApi(score: FdScore) {
  const scoreHome = score.regularTime?.home ?? score.fullTime?.home ?? null
  const scoreAway = score.regularTime?.away ?? score.fullTime?.away ?? null
  const et = score.extraTime
  const pen = score.penalties
  const homeAfterEt =
    scoreHome != null && scoreAway != null && et?.home != null && et?.away != null
      ? scoreHome + et.home
      : null
  const awayAfterEt =
    scoreHome != null && scoreAway != null && et?.away != null && et?.home != null
      ? scoreAway + et.away
      : null
  return {
    score_home: scoreHome,
    score_away: scoreAway,
    score_home_after_et: homeAfterEt,
    score_away_after_et: awayAfterEt,
    score_home_penalties: pen?.home ?? null,
    score_away_penalties: pen?.away ?? null,
  }
}

async function main() {
  const { data: teams } = await sb.from('teams').select('id,name,code')
  const teamMap = new Map((teams ?? []).map(t => [t.id, t]))

  const { data: matches, error } = await sb
    .from('matches')
    .select(
      'id,provider_match_id,status,score_home,score_away,score_home_after_et,score_away_after_et,score_home_penalties,score_away_penalties,scored_at,home_team_id,away_team_id,kick_off',
    )
    .eq('phase', 'LAST_32')
    .order('kick_off')

  if (error) throw error

  const report: Record<string, unknown>[] = []
  let fixed = 0
  let rescored = 0
  let skipped = 0

  for (const m of (matches ?? []) as MatchRow[]) {
    const ht = teamMap.get(m.home_team_id)
    const at = teamMap.get(m.away_team_id)
    const label = `${ht?.code ?? '?'} vs ${at?.code ?? '?'}`

    const entry: Record<string, unknown> = {
      match_id: m.id,
      label,
      status: m.status,
      db: {
        score90: `${m.score_home}-${m.score_away}`,
        afterEt: `${m.score_home_after_et ?? '—'}-${m.score_away_after_et ?? '—'}`,
        pen: `${m.score_home_penalties ?? '—'}-${m.score_away_penalties ?? '—'}`,
      },
    }

    if (!m.provider_match_id || m.status !== 'finished') {
      entry.issue = m.status !== 'finished' ? 'not_finished' : 'no_provider_id'
      report.push(entry)
      skipped++
      continue
    }

    const apiScore = await fetchFdScore(String(m.provider_match_id))
    if (!apiScore) {
      entry.issue = 'api_fetch_failed'
      report.push(entry)
      skipped++
      continue
    }

    const expected = expectedFromApi(apiScore)
    entry.api = {
      regularTime: apiScore.regularTime,
      extraTime: apiScore.extraTime,
      fullTime: apiScore.fullTime,
      penalties: apiScore.penalties,
      expected90: `${expected.score_home}-${expected.score_away}`,
      expectedAfterEt: `${expected.score_home_after_et ?? '—'}-${expected.score_away_after_et ?? '—'}`,
    }

    const mismatch =
      expected.score_home != null &&
      expected.score_away != null &&
      (m.score_home !== expected.score_home ||
        m.score_away !== expected.score_away ||
        m.score_home_after_et !== expected.score_home_after_et ||
        m.score_away_after_et !== expected.score_away_after_et ||
        (expected.score_home_penalties != null && m.score_home_penalties !== expected.score_home_penalties) ||
        (expected.score_away_penalties != null && m.score_away_penalties !== expected.score_away_penalties))

    entry.mismatch = mismatch

    if (mismatch) {
      const { data: preds } = await sb
        .from('predictions')
        .select('points')
        .eq('match_id', m.id)
        .eq('status', 'scored')
      entry.scored_predictions = preds?.length ?? 0

      if (doFix && expected.score_home != null && expected.score_away != null) {
        const oldHome = m.score_home
        const oldAway = m.score_away

        await sb
          .from('matches')
          .update({
            ...expected,
            updated_at: new Date().toISOString(),
          })
          .eq('id', m.id)

        if (m.scored_at) {
          const { data: n, error: reErr } = await sb.rpc('rescore_match_predictions', {
            p_match_id: m.id,
            p_old_score_home: oldHome,
            p_old_score_away: oldAway,
          })
          entry.rescored = reErr ? reErr.message : n
          if (!reErr) rescored++
        }

        entry.fixed = true
        fixed++
      }
    }

    report.push(entry)
    const flag = mismatch ? (doFix ? 'FIXED' : 'MISMATCH') : 'OK'
    console.log(`${flag} ${label} | DB ${m.score_home}-${m.score_away} | API 90' ${expected.score_home}-${expected.score_away}`)
  }

  const out = {
    generated_at: new Date().toISOString(),
    fix_mode: doFix,
    total: matches?.length ?? 0,
    mismatches: report.filter(r => r.mismatch).length,
    fixed,
    rescored,
    skipped,
    matches: report,
  }

  const dir = join(process.cwd(), 'reports')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'last32-score-audit.json')
  writeFileSync(path, JSON.stringify(out, null, 2))

  console.log(`\nReporte: ${path}`)
  console.log(`Total: ${out.total} | Desvíos: ${out.mismatches} | Corregidos: ${fixed} | Repuntuados: ${rescored}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
