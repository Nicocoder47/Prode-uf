import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FixtureBoard, FixtureGroupHub, MatchPredictionModal } from '../../components/worldcup'
import { FixtureGameCenter } from '../../components/worldcup/fixture/FixtureGameCenter'
import { DataState } from '../../components/ui/DataState'
import { useWorldCupMatches, usePredictions, useLeaderboard } from '../../useWorldCupData'
import { useAuth } from '../../lib/auth'
import { useSavePrediction } from '../../hooks/useSavePrediction'
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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [predictMatch, setPredictMatch] = useState<Match | null>(null)
  const selectedGroup = searchParams.get('group')

  const setSelectedGroup = (groupId: string | null) => {
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
  const me = useMemo(() => leaderboard.find(e => e.userId === user?.id), [leaderboard, user?.id])
  const leader = leaderboard[0]

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

  const gameCenter =
    user?.id && !selectedGroup && !isLoading && !isError ? (
      <FixtureGameCenter
        overall={overall}
        groupProgress={groupProgress}
        predictions={predictions}
        matches={matches}
        me={me}
        leader={leader}
        recommendedGroupLabel={recommended?.groupId ?? null}
        onCompletePredictions={handleCompletePredictions}
      />
    ) : null

  const modal = predictMatch && (
    <MatchPredictionModal
      key={predictMatch.id}
      match={predictMatch}
      isOpen={!!predictMatch}
      onClose={() => setPredictMatch(null)}
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
      <div className="md:hidden">
        {selectedGroup ? (
          <header className="wc26-fixture-hero-header mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FFD700]">Centro del juego</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white">Grupo {selectedGroup}</h1>
            <p className="mt-1 text-sm text-white/75">Predecí los partidos de tu grupo</p>
          </header>
        ) : (
          gameCenter
        )}

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
                onSelectGroup={setSelectedGroup}
                onPredict={openPredict}
              />
            ) : (
              <div className="mt-4">
                <p className="wc26-fixture-premium-section-kicker mb-2 px-1">Grupos del Mundial</p>
                <FixtureGroupHub
                  matches={matches}
                  predictions={predictions}
                  selectedGroup={selectedGroup}
                  onSelectGroup={setSelectedGroup}
                  onPredict={openPredict}
                />
              </div>
            )}
          </>
        )}

        {selectedGroup && overall.pending > 0 ? (
          <div className="wc26-fixture-sticky-spacer" aria-hidden="true" />
        ) : null}
        {selectedGroup && overall.pending > 0 ? (
          <button type="button" className="wc26-fixture-sticky-cta" onClick={handleCompletePredictions}>
            Completar predicciones
          </button>
        ) : null}
      </div>

      <div className="hidden space-y-6 md:block">
        {selectedGroup ? (
          <div className="wc26-fixture-hero-header p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FFD700]">Centro del juego</p>
            <h1 className="mt-1 text-3xl font-extrabold text-white">Grupo {selectedGroup}</h1>
            <p className="mt-2 text-sm text-white/70">Predecí los partidos de tu grupo.</p>
          </div>
        ) : (
          gameCenter
        )}

        {isLoading && <DataState isLoading loadingMessage="Cargando partidos..." />}
        {(isError || error) && (
          <DataState isError errorMessage="Error al cargar partidos." onRetry={() => refetch()} />
        )}
        {!isLoading && !isError && !error && matches.length === 0 && (
          <DataState isEmpty emptyMessage={emptyStateMessage(EMPTY.matchesUpdating, 'npm run sync:fixtures')} />
        )}
        {!isLoading && !isError && matches.length > 0 && (
          <>
            {!selectedGroup ? (
              <p className="wc26-fixture-premium-section-kicker">Grupos del Mundial</p>
            ) : null}
            <FixtureGroupHub
              matches={matches}
              predictions={predictions}
              selectedGroup={selectedGroup}
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
