import '../../styles/fixture.css'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { MatchPredictionModal } from '../../components/worldcup'
import { PhaseTabBar, PhaseProgressBar, GroupPhaseView, KnockoutPhaseView } from '../../components/worldcup/phases'
import { DataState } from '../../components/ui/DataState'
import { useWorldCupMatches, usePredictions, useLeaderboard } from '../../useWorldCupData'
import { useAuth } from '../../lib/auth'
import { useSavePrediction } from '../../hooks/useSavePrediction'
import { useTodayResultsSync } from '../../hooks/useTodayResultsSync.ts'
import { computeAllPhasesProgress } from '../../constants/phases'
import {
  buildPredictionMap,
  computeGroupProgress,
  computeOverallProgress,
  getMatchPredictUiStatus,
  getRecommendedGroup,
  groupMatches,
} from '../../utils/predictionProgress'
import { emptyStateMessage, EMPTY } from '../../utils/emptyState'
import type { Match, MatchStage } from '../../types/worldcup'

export default function MatchesPage() {
  useTodayResultsSync()

  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [predictMatch, setPredictMatch] = useState<Match | null>(null)

  const activePhase = (searchParams.get('phase') as MatchStage) || 'group'
  const selectedGroup = searchParams.get('group')

  const setActivePhase = (phase: MatchStage) => {
    setPredictMatch(null)
    const params: Record<string, string> = { phase }
    if (phase === 'group' && selectedGroup) params.group = selectedGroup
    setSearchParams(params)
  }

  const setSelectedGroup = (groupId: string | null) => {
    if (groupId !== selectedGroup) setPredictMatch(null)
    const params: Record<string, string> = { phase: 'group' }
    if (groupId) params.group = groupId
    setSearchParams(params)
  }

  const { data: matches = [], isLoading, isError, error, refetch } = useWorldCupMatches()
  const { data: predictions = [] } = usePredictions(user?.id)
  const { data: leaderboard = [] } = useLeaderboard()
  const savePrediction = useSavePrediction(user?.id)
  const predictionSet = useMemo(() => new Set(predictions.map(p => p.matchId)), [predictions])
  const overall = useMemo(() => computeOverallProgress(matches, predictionSet), [matches, predictionSet])
  const groupProgress = useMemo(() => computeGroupProgress(matches, predictionSet), [matches, predictionSet])
  const recommended = useMemo(() => getRecommendedGroup(groupProgress), [groupProgress])
  const phasesProgress = useMemo(() => computeAllPhasesProgress(matches, predictionSet), [matches, predictionSet])
  const myPoints = useMemo(
    () => leaderboard.find(lb => lb.userId === user?.id)?.points ?? 0,
    [leaderboard, user?.id],
  )

  const openPredict = (match: Match) => {
    if (!user?.id) {
      navigate('/login')
      return
    }
    setPredictMatch(match)
  }

  const handleCompletePredictions = () => {
    const targetGroup = selectedGroup ?? recommended?.groupId
    if (!targetGroup) return
    if (!selectedGroup) setSelectedGroup(targetGroup)

    const predMap = buildPredictionMap(predictions)
    const next = groupMatches(matches, targetGroup).find(m => {
      const status = getMatchPredictUiStatus(m, predMap.get(m.id))
      return (
        status === 'available' ||
        (status === 'predicted' && m.status === 'scheduled' && !m.isLocked)
      )
    })
    if (next) openPredict(next)
  }

  const modal = predictMatch && (
    <MatchPredictionModal
      key={predictMatch.id}
      match={predictMatch}
      isOpen={!!predictMatch}
      onClose={() => setPredictMatch(null)}
      allMatches={matches}
      onContinueNext={setPredictMatch}
      existingPrediction={predictions.find(p => p.matchId === predictMatch.id)}
      onSave={async payload => {
        await savePrediction.mutateAsync({
          matchId: predictMatch.id,
          homeScore: payload.exactScore?.home ?? 0,
          awayScore: payload.exactScore?.away ?? 0,
          etHomeScore: payload.etScore?.home ?? null,
          etAwayScore: payload.etScore?.away ?? null,
          penaltyWinner: payload.penaltyWinner ?? null,
        })
      }}
    />
  )

  return (
    <>
      <div className="wc26-phases-page">
        {/* Hero header */}
        <header className="wc26-phases-hero">
          <p className="wc26-phases-hero__eyebrow">FIFA World Cup 2026</p>
          <h1 className="wc26-phases-hero__title">Predicciones</h1>
          <p className="wc26-phases-hero__subtitle">
            {myPoints > 0 ? `${myPoints} puntos acumulados` : 'Predecí los resultados y sumá puntos'}
          </p>
        </header>

        {/* Phase TabBar */}
        {!isLoading && matches.length > 0 && (
          <PhaseTabBar
            activePhase={activePhase}
            onChangePhase={setActivePhase}
            progress={phasesProgress}
          />
        )}

        {/* Progress indicator */}
        {user?.id && !isLoading && matches.length > 0 && (
          <PhaseProgressBar progress={phasesProgress} activePhase={activePhase} />
        )}

        {/* Content */}
        {isLoading && <DataState isLoading loadingMessage="Cargando partidos..." />}
        {(isError || error) && (
          <DataState isError errorMessage="No pudimos cargar los partidos." onRetry={() => refetch()} />
        )}
        {!isLoading && !isError && !error && matches.length === 0 && (
          <DataState isEmpty emptyMessage={emptyStateMessage(EMPTY.matchesUpdating, 'npm run sync:fixtures')} />
        )}

        {!isLoading && !isError && matches.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activePhase}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="wc26-phases-content"
            >
              {activePhase === 'group' ? (
                <GroupPhaseView
                  matches={matches}
                  predictions={predictions}
                  selectedGroup={selectedGroup}
                  recommendedGroupId={recommended?.groupId ?? null}
                  onSelectGroup={setSelectedGroup}
                  onPredict={openPredict}
                  onCompletePredictions={handleCompletePredictions}
                  showCompleteCta={overall.pending > 0}
                  activeMatchId={predictMatch?.id ?? null}
                />
              ) : (
                <KnockoutPhaseView
                  stage={activePhase}
                  matches={matches}
                  predictions={predictions}
                  onPredict={openPredict}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {modal}
    </>
  )
}
