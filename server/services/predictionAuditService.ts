/**
 * Auditoría de predicciones — usa Supabase real (service role).
 * Scoring autoritativo: public.score_match_predictions (migration 20240104000000_v5_realtime_scoring.sql)
 */
import { supabase } from '../../src/database/supabaseClient.js'
import { getWinnerFromScore, isPredictionCoherent } from '../../src/utils/predictionValidation.js'

type PredictionRow = {
  id: string
  user_id: string
  match_id: string
  status: string
  predicted_winner: string | null
  predicted_score_home: number | null
  predicted_score_away: number | null
  points: number | null
}

type MatchRow = {
  id: string
  status: string
  score_home: number | null
  score_away: number | null
  scored_at: string | null
  kick_off: string | null
  home_team_id: string | null
  away_team_id: string | null
}

export type PredictionAuditReport = {
  generatedAt: string
  counts: {
    pending: number
    locked: number
    scored: number
    total: number
  }
  platform: {
    totalUsers: number
    totalMatches: number
    finishedMatches: number
    liveMatches: number
    scoredMatches: number
    pendingScoringMatches: number
  }
  unscoredOnFinished: Array<{
    predictionId: string
    matchId: string
    userId: string
    status: string
  }>
  finishedWithoutScoring: Array<{
    matchId: string
    scoreHome: number | null
    scoreAway: number | null
    kickoff: string | null
    pendingPredictions: number
  }>
  inconsistent: Array<{
    predictionId: string
    matchId: string
    userId: string
    status: string
    predictedWinner: string
    scoreHome: number
    scoreAway: number
    derivedWinner: string
  }>
  scoringRules: {
    source: string
    exactScore: number
    correctResult: number
    firstScorerBonus: number
    mvpBonus: number
    exclusiveExactOrResult: boolean
  }
}

export async function getPredictionAuditReport(): Promise<PredictionAuditReport> {
  const [
    { data: predictions, error: predErr },
    { data: matches, error: matchErr },
    { count: usersCount, error: usersErr },
  ] = await Promise.all([
    supabase
      .from('predictions')
      .select('id,user_id,match_id,status,predicted_winner,predicted_score_home,predicted_score_away,points'),
    supabase
      .from('matches')
      .select('id,status,score_home,score_away,scored_at,kick_off,home_team_id,away_team_id'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  if (predErr) throw predErr
  if (matchErr) throw matchErr
  if (usersErr) throw usersErr

  const preds = (predictions ?? []) as PredictionRow[]
  const matchList = (matches ?? []) as MatchRow[]
  const matchById = new Map(matchList.map(m => [m.id, m]))

  const counts = { pending: 0, locked: 0, scored: 0, total: preds.length }
  for (const p of preds) {
    if (p.status === 'pending') counts.pending++
    else if (p.status === 'locked') counts.locked++
    else if (p.status === 'scored') counts.scored++
  }

  const unscoredOnFinished = preds
    .filter(p => {
      const m = matchById.get(p.match_id)
      return m?.status === 'finished' && p.status !== 'scored'
    })
    .map(p => ({
      predictionId: p.id,
      matchId: p.match_id,
      userId: p.user_id,
      status: p.status,
    }))

  const finishedWithoutScoring = matchList
    .filter(
      m =>
        m.status === 'finished' &&
        m.scored_at == null &&
        m.score_home != null &&
        m.score_away != null
    )
    .map(m => ({
      matchId: m.id,
      scoreHome: m.score_home,
      scoreAway: m.score_away,
      kickoff: m.kick_off,
      pendingPredictions: preds.filter(
        p => p.match_id === m.id && (p.status === 'pending' || p.status === 'locked')
      ).length,
    }))

  const inconsistent = preds
    .filter(p => {
      if (p.predicted_score_home == null || p.predicted_score_away == null || !p.predicted_winner) return false
      return !isPredictionCoherent(p.predicted_winner, p.predicted_score_home, p.predicted_score_away)
    })
    .map(p => ({
      predictionId: p.id,
      matchId: p.match_id,
      userId: p.user_id,
      status: p.status,
      predictedWinner: p.predicted_winner!,
      scoreHome: p.predicted_score_home!,
      scoreAway: p.predicted_score_away!,
      derivedWinner: getWinnerFromScore(p.predicted_score_home!, p.predicted_score_away!),
    }))

  return {
    generatedAt: new Date().toISOString(),
    counts,
    platform: {
      totalUsers: usersCount ?? 0,
      totalMatches: matchList.length,
      finishedMatches: matchList.filter(m => m.status === 'finished').length,
      liveMatches: matchList.filter(m => m.status === 'live' || m.status === 'halftime').length,
      scoredMatches: matchList.filter(m => m.scored_at != null).length,
      pendingScoringMatches: finishedWithoutScoring.length,
    },
    unscoredOnFinished,
    finishedWithoutScoring,
    inconsistent,
    scoringRules: {
      source: 'score_match_predictions (Supabase migration v5)',
      exactScore: 5,
      correctResult: 3,
      firstScorerBonus: 2,
      mvpBonus: 2,
      maxPerMatchUi: 5,
      maxPerMatchEngine: 9,
      exclusiveExactOrResult: true,
    },
  }
}

export async function runMatchScoring(matchId: string) {
  const { data, error } = await supabase.rpc('score_match_predictions', { p_match_id: matchId })
  if (error) throw error
  return { predictionsScored: data as number }
}

export async function runMatchRescore(matchId: string, oldScoreHome: number, oldScoreAway: number) {
  const { data, error } = await supabase.rpc('rescore_match_predictions', {
    p_match_id: matchId,
    p_old_score_home: oldScoreHome,
    p_old_score_away: oldScoreAway,
  })
  if (error) throw error
  return { predictionsRescored: data as number }
}
