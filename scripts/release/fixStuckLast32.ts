/**
 * Fuerza sync + scoring de partidos LAST_32 atascados en live
 * npx tsx scripts/release/fixStuckLast32.ts
 */
import { loadCloudEnv } from '../lib/loadCloudEnv.js'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

loadCloudEnv()

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const fdKey = process.env.FOOTBALL_DATA_API_KEY!

type FdScore = {
  regularTime?: { home?: number | null; away?: number | null }
  fullTime?: { home?: number | null; away?: number | null }
  extraTime?: { home?: number | null; away?: number | null }
  penalties?: { home?: number | null; away?: number | null }
}

async function fetchFdMatch(providerMatchId: string) {
  const res = await fetch(`https://api.football-data.org/v4/matches/${providerMatchId}`, {
    headers: { 'X-Auth-Token': fdKey },
  })
  if (!res.ok) throw new Error(`football-data HTTP ${res.status}`)
  return res.json() as Promise<{
    status: string
    score: FdScore
    homeTeam: { id: number }
    awayTeam: { id: number }
  }>
}

function mapStatus(s: string): string {
  const m: Record<string, string> = {
    FINISHED: 'finished',
    IN_PLAY: 'live',
    PAUSED: 'halftime',
    SCHEDULED: 'scheduled',
    TIMED: 'scheduled',
  }
  return m[s] ?? 'scheduled'
}

async function main() {
  const { data: stuck, error } = await sb
    .from('matches')
    .select(
      'id,provider_match_id,status,score_home,score_away,phase,home_team_id,away_team_id,scored_at',
    )
    .eq('phase', 'LAST_32')
    .in('status', ['live', 'halftime'])
    .not('provider_match_id', 'is', null)

  if (error) throw error
  console.log('Partidos LAST_32 atascados:', stuck?.length ?? 0)

  for (const m of stuck ?? []) {
    const pid = String(m.provider_match_id)
    console.log(`\n▶ ${pid} DB status=${m.status} score=${m.score_home}-${m.score_away}`)

    let api: Awaited<ReturnType<typeof fetchFdMatch>>
    try {
      await new Promise(r => setTimeout(r, 2000))
      api = await fetchFdMatch(pid)
    } catch (e) {
      console.error('  API error:', e instanceof Error ? e.message : e)
      continue
    }

    const rt = api.score?.regularTime
    const ft = api.score?.fullTime
    const et = api.score?.extraTime
    const pen = api.score?.penalties
    const status = mapStatus(api.status)

    const scoreHome = rt?.home ?? ft?.home
    const scoreAway = rt?.away ?? ft?.away

    if (scoreHome == null || scoreAway == null) {
      console.log(`  API aún sin marcador (${api.status}) — skip`)
      continue
    }

    const homeAfterEt =
      et?.home != null && et?.away != null ? scoreHome + et.home : null
    const awayAfterEt =
      et?.away != null && et?.home != null ? scoreAway + et.away : null

    const patch: Record<string, unknown> = {
      status,
      score_home: scoreHome,
      score_away: scoreAway,
      score_home_after_et: homeAfterEt,
      score_away_after_et: awayAfterEt,
      score_home_penalties: pen?.home ?? null,
      score_away_penalties: pen?.away ?? null,
      updated_at: new Date().toISOString(),
    }

    if (status !== 'finished') {
      console.log(`  API status=${api.status} — actualizando marcador parcial`)
    } else {
      console.log(
        `  API FINISHED ${scoreHome}-${scoreAway} ET=${homeAfterEt ?? '—'}-${awayAfterEt ?? '—'} PEN=${pen?.home ?? '—'}-${pen?.away ?? '—'}`,
      )
    }

    const { error: updErr } = await sb.from('matches').update(patch).eq('id', m.id)
    if (updErr) {
      console.error('  UPDATE error:', JSON.stringify(updErr))
      continue
    }
    console.log('  ✓ match updated')

    if (status === 'finished') {
      const { data: scored, error: rpcErr } = await sb.rpc('score_match_predictions', {
        p_match_id: m.id,
      })
      if (rpcErr) console.error('  score RPC error:', rpcErr.message)
      else console.log(`  ✓ score_match_predictions → ${scored} preds`)
    }
  }

  // Verificar Lucio BRA-JPN
  const { data: lucio } = await sb
    .from('profiles')
    .select('id')
    .ilike('email', '%lucioaseguin%')
    .maybeSingle()

  if (lucio) {
    const { data: pred } = await sb
      .from('predictions')
      .select('status,points,predicted_score_home,predicted_score_away')
      .eq('user_id', lucio.id)
      .eq(
        'match_id',
        (
          await sb
            .from('matches')
            .select('id')
            .eq('provider_match_id', '537423')
            .maybeSingle()
        ).data?.id ?? '',
      )
      .maybeSingle()
    console.log('\nLucio BRA-JPN:', pred)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
