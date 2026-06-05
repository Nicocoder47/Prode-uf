import type { Match, Prediction, Team } from '../types/worldcup'
import { normalizeGroupId, WC26_GROUP_NAMES } from '../constants/groups'

/** Máximo teórico por partido: exacto (5) + goleador (2) + MVP (2) */
export const MAX_POINTS_PER_MATCH = 9

export type MatchPredictUiStatus = 'available' | 'predicted' | 'closed' | 'scored' | 'missed'

export type GroupProgress = {
  groupId: string
  total: number
  predicted: number
  pending: number
  complete: boolean
}

export type AchievementId =
  | 'first_hit'
  | 'ten_hits'
  | 'fifty_hits'
  | 'perfect_prediction'
  | 'top_10'

export type Achievement = {
  id: AchievementId
  label: string
  unlocked: boolean
  progress?: string
}

export type StreakInfo = {
  predictionStreak: number
  dayStreak: number
}

export type OverallProgress = {
  total: number
  predicted: number
  pending: number
  percent: number
  remainingPoints: number
}

export function getGroupTeams(matches: Match[], groupId: string): Team[] {
  const teams = new Map<string, Team>()
  for (const m of groupMatches(matches, groupId)) {
    if (m.homeTeam) teams.set(m.homeTeam.id, m.homeTeam)
    if (m.awayTeam) teams.set(m.awayTeam.id, m.awayTeam)
  }
  return [...teams.values()]
}

export function countOpenPendingMatches(matches: Match[], predictionIds: Set<string>, groupId?: string): number {
  const list = groupId ? groupMatches(matches, groupId) : matches
  return list.filter(m => m.status === 'scheduled' && !m.isLocked && !predictionIds.has(m.id)).length
}

export function computeRemainingPoints(matches: Match[], predictionIds: Set<string>, groupId?: string): number {
  return countOpenPendingMatches(matches, predictionIds, groupId) * MAX_POINTS_PER_MATCH
}

export function computeAchievements(predictions: Prediction[], rank: number | null): Achievement[] {
  const scored = predictions.filter(p => p.status === 'scored')
  const hits = scored.filter(p => p.points > 0).length
  const hasPerfect = scored.some(p => p.points >= MAX_POINTS_PER_MATCH)

  return [
    { id: 'first_hit', label: 'Primer acierto', unlocked: hits >= 1, progress: `${Math.min(hits, 1)}/1` },
    { id: 'ten_hits', label: '10 aciertos', unlocked: hits >= 10, progress: `${Math.min(hits, 10)}/10` },
    { id: 'fifty_hits', label: '50 aciertos', unlocked: hits >= 50, progress: `${Math.min(hits, 50)}/50` },
    { id: 'perfect_prediction', label: 'Predicción perfecta', unlocked: hasPerfect },
    { id: 'top_10', label: 'Top 10', unlocked: rank != null && rank <= 10, progress: rank ? `#${rank}` : undefined },
  ]
}

export function computeStreaks(predictions: Prediction[], matches: Match[]): StreakInfo {
  const predictedIds = new Set(predictions.map(p => p.matchId))

  const openSorted = matches
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())

  let predictionStreak = 0
  for (const m of openSorted) {
    if (predictedIds.has(m.id)) predictionStreak++
    else break
  }

  const dayKeys = [...new Set(predictions.map(p => p.createdAt.slice(0, 10)))].sort()
  let dayStreak = 0
  if (dayKeys.length > 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let cursor = new Date(today)
    const daySet = new Set(dayKeys)
    while (daySet.has(cursor.toISOString().slice(0, 10))) {
      dayStreak++
      cursor.setDate(cursor.getDate() - 1)
    }
  }

  return { predictionStreak, dayStreak }
}

export function countMissedOpportunitiesInGroup(
  matches: Match[],
  groupId: string,
  predictionIds: Set<string>
): number {
  return groupMatches(matches, groupId).filter(
    m =>
      !predictionIds.has(m.id) &&
      (m.status === 'finished' || m.status === 'live' || m.status === 'halftime' || (m.isLocked && m.status === 'scheduled'))
  ).length
}

export function getGroupContinueMessage(progress: GroupProgress, missed: number): string {
  if (progress.total > 0 && progress.predicted >= progress.total) return 'Grupo completo'
  if (progress.predicted === 0) return 'Empezá este grupo'
  if (progress.pending > 0) return `Te faltan ${progress.pending} predicciones`
  if (missed > 0) return `Perdiste ${missed} oportunidad${missed === 1 ? '' : 'es'}`
  return 'Seguí sumando puntos'
}

export function getMatchPredictUiStatus(match: Match, prediction?: Prediction | null): MatchPredictUiStatus {
  if (prediction?.status === 'scored') return 'scored'
  if (match.status === 'finished' && !prediction) return 'missed'
  if (prediction) return 'predicted'
  if (match.isLocked || match.status !== 'scheduled') return 'closed'
  return 'available'
}

export const MATCH_PREDICT_STATUS_LABEL: Record<MatchPredictUiStatus, string> = {
  available: 'Disponible',
  predicted: 'Predicho',
  closed: 'Cerrado',
  scored: 'Puntuado',
  missed: 'No participaste',
}

export function buildPredictionMap(predictions: Prediction[]) {
  return new Map(predictions.map(p => [p.matchId, p]))
}

export function computeGroupProgress(
  matches: Match[],
  predictionIds: Set<string>
): GroupProgress[] {
  const byGroup = new Map<string, Match[]>()

  for (const m of matches) {
    const gid = normalizeGroupId(m.group)
    if (!gid) continue
    if (!byGroup.has(gid)) byGroup.set(gid, [])
    byGroup.get(gid)!.push(m)
  }

  return WC26_GROUP_NAMES.filter(id => (byGroup.get(id)?.length ?? 0) > 0).map(groupId => {
    const groupMatches = byGroup.get(groupId) ?? []
    const predicted = groupMatches.filter(m => predictionIds.has(m.id)).length
    const total = groupMatches.length
    const pending = Math.max(0, groupMatches.filter(m => m.status === 'scheduled' && !m.isLocked).length - groupMatches.filter(m => m.status === 'scheduled' && !m.isLocked && predictionIds.has(m.id)).length)

    return {
      groupId,
      total,
      predicted,
      pending,
      complete: pending === 0 && predicted > 0,
    }
  })
}

export function computeOverallProgress(matches: Match[], predictionIds: Set<string>): OverallProgress {
  const openMatches = matches.filter(m => m.status === 'scheduled')
  const total = openMatches.length || matches.length
  const predicted = openMatches.filter(m => predictionIds.has(m.id)).length
  const pending = openMatches.filter(m => !m.isLocked && !predictionIds.has(m.id)).length
  const percent = total > 0 ? Math.round((predicted / total) * 100) : 0
  const remainingPoints = computeRemainingPoints(matches, predictionIds)
  return { total, predicted, pending, percent, remainingPoints }
}

export function getIncompleteGroups(progress: GroupProgress[]): GroupProgress[] {
  return progress.filter(g => g.pending > 0).sort((a, b) => b.pending - a.pending)
}

export function groupMatches(matches: Match[], groupId: string): Match[] {
  const id = normalizeGroupId(groupId)
  return matches
    .filter(m => normalizeGroupId(m.group) === id)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
}

export function listGroupsWithMatches(matches: Match[]): string[] {
  const set = new Set<string>()
  for (const m of matches) {
    const g = normalizeGroupId(m.group)
    if (g) set.add(g)
  }
  return WC26_GROUP_NAMES.filter(g => set.has(g))
}
