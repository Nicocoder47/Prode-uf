import '../../styles/fixture.css'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FixtureBoard, FixtureGroupHub, MatchPredictionModal } from '../../components/worldcup'
import { FixtureGameCenter } from '../../components/worldcup/fixture/FixtureGameCenter'
import { DataState } from '../../components/ui/DataState'
import { useWorldCupMatches, usePredictions, useLeaderboard } from '../../useWorldCupData'
import { useAuth } from '../../lib/auth'
import { useSavePrediction } from '../../hooks/useSavePrediction'
import { useTodayResultsSync } from '../../hooks/useTodayResultsSync.ts'
import {
  buildPredictionMap,
  computeGroupProgress,
  computeOverallProgress,
  getMatchPredictUiStatus,
  getRecommendedGroup,
  groupMatches,
} from '../../utils/predictionProgress'
import { emptyStateMessage, EMPTY } from '../../utils/emptyState'
import type { Match } from '../../types/worldcup'

export default function MatchesPage() {
  useTodayResultsSync()

  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [predictMatch, setPredictMatch] = useState<Match | null>(null)
  const selectedGroup = searchParams.get('group')

  const setSelectedGroup = (groupId: string | null) => {
    if (groupId !== selectedGroup) setPredictMatch(null)
    if (groupId) setSearchParams({ group: groupId })
    else setSearchParams({})
  }

  const { data: matches = [], isLoading, isError, error, refetch } = useWorldCupMatches()
  const { data: predictions = [] } = usePredictions(user?.id)
  const { data: leaderboard = [] } = useLeaderboard()
  const savePrediction = useSavePrediction(user?.id)
  const predictionSet = useMemo(() => new Set(predictions.map(p => p.matchId)), [predictions])
  const overall = useMemo(() => computeOverallProgress(matches, predictionSet), [matches, predictionSet])
  const groupProgress = useMemo(() => computeGroupProgress(matches, predictionSet), [matches, predictionSet])
  const recommended = useMemo(() => getRecommendedGroup(groupProgress), [groupProgress])
  const myPoints = useMemo(
    () => leaderboard.find(lb => lb.userId === user?.id)?.points ?? 0,
    [leaderboard, user?.id]
  )

  const openPredict = (match: Match) => {
    if (!user?.id) {
      navigate('/login')
      return
    }
    setPredictMatch(match)
  }

  const handleStartPredict = () => {
    if (recommended?.groupId) {
      setSelectedGroup(recommended.groupId)
      return
    }
    document.getElementById('fixture-groups-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  const showGameCenter = user?.id && !selectedGroup && !isLoading && !isError

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
        })
      }}
    />
  )

  return (
    <>
      <div className={`wc26-fixture-page md:hidden${selectedGroup ? ' wc26-fixture-page--group-fit' : ''}`}>
        {!selectedGroup && showGameCenter ? (
          <FixtureGameCenter
            overall={overall}
            predictions={predictions}
            matches={matches}
            points={myPoints}
            onStartPredict={handleStartPredict}
          />
        ) : null}

        {isLoading && <DataState isLoading loadingMessage="Cargando fixture..." />}
        {(isError || error) && (
          <DataState isError errorMessage="No pudimos cargar los partidos." onRetry={() => refetch()} />
        )}
        {!isLoading && !isError && (
          <>
            {selectedGroup ? (
              <FixtureGroupHub
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
              <section id="fixture-groups-section" className="wc26-fgc-groups-section mt-4">
                <FixtureGroupHub
                  matches={matches}
                  predictions={predictions}
                  selectedGroup={selectedGroup}
                  recommendedGroupId={recommended?.groupId ?? null}
                  onSelectGroup={setSelectedGroup}
                  onPredict={openPredict}
                />
              </section>
            )}
          </>
        )}

      </div>

      <div className="wc26-fixture-page hidden space-y-6 md:block">
        {selectedGroup ? (
          <div className="wc26-fixture-hero-header p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#22C55E]">Centro del juego</p>
            <h1 className="mt-1 text-3xl font-extrabold text-white">Grupo {selectedGroup}</h1>
          </div>
        ) : showGameCenter ? (
          <FixtureGameCenter
            overall={overall}
            predictions={predictions}
            matches={matches}
            points={myPoints}
            onStartPredict={handleStartPredict}
          />
        ) : null}

        {isLoading && <DataState isLoading loadingMessage="Cargando partidos..." />}
        {(isError || error) && (
          <DataState isError errorMessage="Error al cargar partidos." onRetry={() => refetch()} />
        )}
        {!isLoading && !isError && !error && matches.length === 0 && (
          <DataState isEmpty emptyMessage={emptyStateMessage(EMPTY.matchesUpdating, 'npm run sync:fixtures')} />
        )}
        {!isLoading && !isError && matches.length > 0 && (
          <>
            <FixtureGroupHub
              matches={matches}
              predictions={predictions}
              selectedGroup={selectedGroup}
              recommendedGroupId={recommended?.groupId ?? null}
              onSelectGroup={setSelectedGroup}
              onPredict={openPredict}
            />
            {!selectedGroup ? (
              <FixtureBoard matches={matches} title="Calendario completo" onMatchClick={id => navigate(`/matches/${id}`)} />
            ) : null}
          </>
        )}
      </div>

      {modal}
    </>
  )
}
