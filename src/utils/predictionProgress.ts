import type { Match, MatchStage, Prediction, Team } from '../types/worldcup'
import { normalizeGroupId, WC26_GROUP_NAMES } from '../constants/groups'
import { TOURNAMENT_PHASES } from '../constants/phases'
import { maxPointsForMatch } from '../constants/knockoutScoring'

/** Máximo por partido en fase de grupos (exacto 5 / resultado 3). */
export const MAX_POINTS_PER_MATCH = 5

export { maxPointsForMatch }

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

export type ProfileCompetitiveStats = {
  totalPoints: number
  predictionsCount: number
  hits: number
  exactHits: number
  drawHits: number
  misses: number
  accuracy: number | null
}

export function computeProfileStats(
  predictions: Prediction[],
  matches: Match[],
  leaderboardPoints?: number,
  leaderboardDraws?: number
): ProfileCompetitiveStats {
  const scored = predictions.filter(p => p.status === 'scored')
  const matchMap = new Map(matches.map(m => [m.id, m]))
  let exactHits = 0
  let misses = 0
  let hits = 0

  for (const p of scored) {
    const match = matchMap.get(p.matchId)
    const home = p.predictedHomeScore ?? p.exactScore?.home ?? null
    const away = p.predictedAwayScore ?? p.exactScore?.away ?? null

    if ((p.points ?? 0) <= 0) {
      misses++
      continue
    }

    hits++

    const isExact =
      match != null &&
      match.homeScore != null &&
      match.awayScore != null &&
      home != null &&
      away != null &&
      home === match.homeScore &&
      away === match.awayScore

    if (isExact) exactHits++
  }

  return {
    totalPoints: leaderboardPoints ?? predictions.reduce((sum, p) => sum + (p.points ?? 0), 0),
    predictionsCount: predictions.length,
    hits,
    exactHits,
    drawHits: leaderboardDraws ?? 0,
    misses,
    accuracy: scored.length > 0 ? Math.round((hits / scored.length) * 100) : null,
  }
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
  if (match.kickoff && new Date(match.kickoff) <= new Date()) return 'closed'
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

export function getRecommendedGroup(progress: GroupProgress[]): GroupProgress | null {
  const incomplete = progress.filter(g => g.pending > 0)
  if (incomplete.length === 0) return null
  return [...incomplete].sort((a, b) => {
    const scoreA = a.predicted > 0 ? a.pending : a.pending + 1000
    const scoreB = b.predicted > 0 ? b.pending : b.pending + 1000
    return scoreA - scoreB
  })[0]
}

export function getFixtureMotivation(overall: OverallProgress): string {
  if (overall.total <= 0) return 'Cuando haya partidos disponibles, empezá a predecir.'
  if (overall.percent >= 100) return '¡Mundial completo! Ahora a sumar puntos con cada partido.'
  if (overall.percent >= 85) return 'Vas muy bien. Estás cerca de completar el Mundial.'
  if (overall.predicted === 0 || overall.percent < 35) {
    return 'Comenzá a completar tus grupos para no perder puntos.'
  }
  return 'Seguí sumando y alcanzá la gloria.'
}

export function getGroupMaxPoints(totalMatches: number): number {
  return totalMatches * MAX_POINTS_PER_MATCH
}

export function getGroupPointsEarned(
  predictions: Prediction[],
  matches: Match[],
  groupId: string
): number {
  const groupMatchIds = new Set(groupMatches(matches, groupId).map(m => m.id))
  return predictions
    .filter(p => groupMatchIds.has(p.matchId))
    .reduce((sum, p) => sum + (p.points ?? 0), 0)
}

export type GroupCardState = 'complete' | 'recommended' | 'in_progress' | 'not_started'

export function getGroupCardState(
  progress: GroupProgress,
  recommendedGroupId: string | null
): GroupCardState {
  if (progress.complete || (progress.pending === 0 && progress.predicted > 0)) return 'complete'
  if (recommendedGroupId === progress.groupId) return 'recommended'
  if (progress.predicted > 0) return 'in_progress'
  return 'not_started'
}

export function getGroupMotivation(progress: GroupProgress): string {
  const maxPts = getGroupMaxPoints(progress.total)
  if (progress.complete || (progress.pending === 0 && progress.predicted > 0)) {
    return 'Grupo completo. ¡Buen trabajo!'
  }
  return `Completá este grupo y sumá hasta ${maxPts} puntos.`
}

export function getTotalMaxPoints(totalMatches: number): number {
  return totalMatches * MAX_POINTS_PER_MATCH
}

export function getNextRewardMilestone(percent: number): number {
  const milestones = [25, 50, 75, 100]
  return milestones.find(m => m > percent) ?? 100
}

export type PlayStep = { id: string; label: string; state: 'done' | 'active' | 'upcoming' }

export function getPlaySteps(overall: OverallProgress, predictions: Prediction[]): PlayStep[] {
  const hasScored = predictions.some(p => p.status === 'scored')
  const hasPredictions = predictions.length > 0
  const steps: PlayStep[] = [
    { id: 'group', label: 'Elegí grupo', state: 'upcoming' },
    { id: 'predict', label: 'Predecí', state: 'upcoming' },
    { id: 'points', label: 'Sumá puntos', state: 'upcoming' },
  ]

  if (hasScored) {
    steps.forEach(s => { s.state = 'done' })
    return steps
  }
  if (overall.pending === 0 && overall.predicted > 0) {
    steps[0].state = 'done'
    steps[1].state = 'done'
    steps[2].state = 'active'
    return steps
  }
  if (hasPredictions) {
    steps[0].state = 'done'
    steps[1].state = 'active'
    return steps
  }
  steps[0].state = 'active'
  return steps
}

export function getGroupStatusLabel(state: GroupCardState): string {
  if (state === 'complete') return 'COMPLETO'
  if (state === 'recommended' || state === 'in_progress') return 'EN CURSO'
  return 'PENDIENTE'
}

export function getGroupPredictionClose(matches: Match[], groupId: string): Date | null {
  const upcoming = groupMatches(matches, groupId)
    .filter(m => m.status === 'scheduled' && !m.isLocked)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
  if (upcoming.length === 0) return null
  return new Date(upcoming[0].kickoff)
}

export function formatPredictionClose(date: Date): string {
  return date.toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace('.', '').toUpperCase()
}

function kickoffMs(match: Match): number {
  return new Date(match.kickoff).getTime()
}

/** Ventana estimada de un partido; después se asume terminado aunque el sync tarde. */
const MATCH_RUNTIME_MS = 2.5 * 60 * 60 * 1000

export type NextMatchPhase = 'countdown' | 'starting_soon' | 'live' | 'none'

export function shortTeamDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1]! : parts[0] ?? name
}

function hasResolvedTeams(match: Match): boolean {
  const homeCode = match.homeTeam?.code?.trim().toUpperCase()
  const awayCode = match.awayTeam?.code?.trim().toUpperCase()
  const homeName = match.homeTeam?.name?.trim().toLowerCase()
  const awayName = match.awayTeam?.name?.trim().toLowerCase()

  return Boolean(
    homeCode &&
      awayCode &&
      homeCode !== 'TBD' &&
      awayCode !== 'TBD' &&
      homeName &&
      awayName &&
      !homeName.includes('por definir') &&
      !awayName.includes('por definir'),
  )
}

/** Próximo partido para home: countdown al futuro; card puede mostrar en vivo o arranca pronto. */
export function resolveNextMatchForHome(matches: Match[], now = Date.now()) {
  const withTeams = matches.filter(
    m =>
      hasResolvedTeams(m) &&
      m.status !== 'finished' &&
      m.status !== 'cancelled' &&
      m.status !== 'postponed',
  )

  const futureScheduled = withTeams
    .filter(m => m.status === 'scheduled' && kickoffMs(m) > now)
    .sort((a, b) => kickoffMs(a) - kickoffMs(b))

  const overdueScheduled = withTeams
    .filter(
      m =>
        m.status === 'scheduled' &&
        kickoffMs(m) <= now &&
        now - kickoffMs(m) < MATCH_RUNTIME_MS,
    )
    .sort((a, b) => kickoffMs(a) - kickoffMs(b))

  const live = withTeams.find(m => m.status === 'live' || m.status === 'halftime')

  const countdownMatch = futureScheduled[0] ?? null

  if (live) {
    return {
      countdownMatch,
      featuredMatch: live,
      predictMatch: countdownMatch ?? live,
      phase: 'live' as NextMatchPhase,
    }
  }

  if (overdueScheduled[0]) {
    return {
      countdownMatch,
      featuredMatch: overdueScheduled[0],
      predictMatch: countdownMatch ?? overdueScheduled[0],
      phase: 'starting_soon' as NextMatchPhase,
    }
  }

  if (countdownMatch) {
    return {
      countdownMatch,
      featuredMatch: countdownMatch,
      predictMatch: countdownMatch,
      phase: 'countdown' as NextMatchPhase,
    }
  }

  return {
    countdownMatch: null,
    featuredMatch: null,
    predictMatch: null,
    phase: 'none' as NextMatchPhase,
  }
}

export function formatNextMatchTeams(match: Match): string {
  const home = match.homeTeam?.name ? shortTeamDisplayName(match.homeTeam.name) : 'Local'
  const away = match.awayTeam?.name ? shortTeamDisplayName(match.awayTeam.name) : 'Visitante'
  return `${home} vs ${away}`
}

export function formatNextMatchKickoff(match: Match): string {
  return new Date(match.kickoff).toLocaleString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/** Partido que debe mostrar el hero (countdown futuro o el que está por empezar / en vivo). */
export function getHeroDisplayMatch(
  resolved: ReturnType<typeof resolveNextMatchForHome>,
): Match | null {
  return resolved.countdownMatch ?? resolved.featuredMatch
}

export function buildMatchCountdown(match: Match | null, now = Date.now()) {
  if (!match) return undefined
  const diff = kickoffMs(match) - now
  if (diff <= 0) return undefined
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  }
}

/** Partido anterior/siguiente del mismo grupo (orden por kickoff). */
export function getAdjacentGroupMatch(
  matches: Match[],
  current: Match,
  direction: 'prev' | 'next',
): Match | null {
  if (!current.group) return null
  const list = matches
    .filter(m => m.group === current.group && m.homeTeam && m.awayTeam)
    .sort((a, b) => kickoffMs(a) - kickoffMs(b))
  const idx = list.findIndex(m => m.id === current.id)
  if (idx < 0) return null
  const target = direction === 'next' ? idx + 1 : idx - 1
  return list[target] ?? null
}

/** Siguiente partido programado del mismo grupo (por fecha de kickoff). */
export function getNextGroupMatch(matches: Match[], current: Match): Match | null {
  if (!current.group) return null
  const currentKick = kickoffMs(current)
  const candidates = matches
    .filter(
      m =>
        m.group === current.group &&
        m.id !== current.id &&
        m.status === 'scheduled' &&
        !m.isLocked &&
        m.homeTeam &&
        m.awayTeam,
    )
    .sort((a, b) => kickoffMs(a) - kickoffMs(b))

  return candidates.find(m => kickoffMs(m) > currentKick) ?? null
}

/** Siguiente partido programado de la misma fase eliminatoria. */
export function getNextStageMatch(matches: Match[], current: Match): Match | null {
  const currentKick = kickoffMs(current)
  const candidates = getMatchesByStage(matches, current.stage).filter(
    m =>
      m.id !== current.id &&
      m.status === 'scheduled' &&
      !m.isLocked &&
      hasResolvedTeams(m),
  )
  return candidates.find(m => kickoffMs(m) > currentKick) ?? candidates[0] ?? null
}

/** Siguiente partido al que el usuario puede continuar (grupo o misma fase). */
export function getNextPredictableMatch(matches: Match[], current: Match): Match | null {
  if (current.group) return getNextGroupMatch(matches, current)
  return getNextStageMatch(matches, current)
}

export function getDaysUntilNextMatch(matches: Match[]): number | null {
  const now = Date.now()
  const next = matches
    .filter(m => m.status === 'scheduled' && kickoffMs(m) > now)
    .sort((a, b) => kickoffMs(a) - kickoffMs(b))[0]
  if (!next) return null
  const diff = kickoffMs(next) - now
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export type FixtureTimelineStep = {
  id: string
  label: string
  state: 'done' | 'active' | 'upcoming'
}

export function getFixtureTimelineSteps(
  overall: OverallProgress,
  predictions: Prediction[],
  matches: Match[]
): FixtureTimelineStep[] {
  const hasPredictions = predictions.length > 0
  const allOpenPredicted = overall.total > 0 && overall.pending === 0
  const hasLiveOrFinished = matches.some(m => m.status !== 'scheduled')
  const hasScored = predictions.some(p => p.status === 'scored')

  const steps: FixtureTimelineStep[] = [
    { id: 'group', label: 'Elegí grupo', state: 'upcoming' },
    { id: 'predict', label: 'Hacé predicciones', state: 'upcoming' },
    { id: 'wait', label: 'Se juegan partidos', state: 'upcoming' },
    { id: 'points', label: 'Sumá puntos', state: 'upcoming' },
  ]

  if (hasScored) {
    steps[0].state = 'done'
    steps[1].state = 'done'
    steps[2].state = 'done'
    steps[3].state = 'done'
    return steps
  }

  if (allOpenPredicted) {
    steps[0].state = 'done'
    steps[1].state = 'done'
    steps[2].state = hasLiveOrFinished ? 'active' : 'done'
    steps[3].state = 'upcoming'
    return steps
  }

  if (hasPredictions) {
    steps[0].state = 'done'
    steps[1].state = 'active'
    return steps
  }

  steps[0].state = 'active'
  return steps
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

/** Grupo anterior/siguiente según el orden oficial A→L (solo grupos con partidos). */
export function getAdjacentGroupId(
  groups: string[],
  currentGroupId: string,
  direction: 'prev' | 'next',
): string | null {
  const id = normalizeGroupId(currentGroupId)
  const idx = groups.findIndex(g => normalizeGroupId(g) === id)
  if (idx < 0) return null
  const target = direction === 'next' ? idx + 1 : idx - 1
  return groups[target] ?? null
}

/* ══ Stage / Phase progress helpers ══ */

export type StageProgress = {
  stage: MatchStage
  total: number
  predicted: number
  pending: number
  complete: boolean
}

export function getMatchesByStage(matches: Match[], stage: MatchStage): Match[] {
  return matches
    .filter(m => m.stage === stage)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
}

export function computeStageProgress(
  matches: Match[],
  predictionIds: Set<string>,
  stage: MatchStage,
): StageProgress {
  const stageMatches = getMatchesByStage(matches, stage)
  const predicted = stageMatches.filter(m => predictionIds.has(m.id)).length
  const pending = stageMatches.filter(
    m => m.status === 'scheduled' && !m.isLocked && !predictionIds.has(m.id),
  ).length
  const total = stageMatches.length
  return {
    stage,
    total,
    predicted,
    pending,
    complete: total > 0 && pending === 0 && predicted > 0,
  }
}

export function getAllStagesProgress(
  matches: Match[],
  predictionIds: Set<string>,
): StageProgress[] {
  return TOURNAMENT_PHASES.map(phase => computeStageProgress(matches, predictionIds, phase.id))
}
