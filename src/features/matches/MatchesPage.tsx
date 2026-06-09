import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlarmClock } from 'lucide-react'
import { FixtureBoard, FixtureGroupHub, MatchPredictionModal } from '../../components/worldcup'
import {
  FixtureGameCenter,
  FixturePlayHeader,
} from '../../components/worldcup/fixture/FixtureGameCenter'
import { DataState } from '../../components/ui/DataState'
import { useWorldCupMatches, usePredictions, useLeaderboard } from '../../useWorldCupData'
import { useAuth } from '../../lib/auth'
import { useSavePrediction } from '../../hooks/useSavePrediction'
import {
  buildPredictionMap,
  computeGroupProgress,
  computeOverallProgress,
  getDaysUntilNextMatch,
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
  const daysUntil = useMemo(() => getDaysUntilNextMatch(matches), [matches])
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
      <div className="wc26-fixture-page md:hidden">
        {!selectedGroup && showGameCenter ? <FixturePlayHeader points={myPoints} /> : null}

        {selectedGroup ? (
          <header className="wc26-fixture-hero-header mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#22C55E]">Centro del juego</p>
            <h1 className="mt-1 text-2xl font-extrabold text-white">Grupo {selectedGroup}</h1>
          </header>
        ) : showGameCenter ? (
          <FixtureGameCenter overall={overall} predictions={predictions} matches={matches} />
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
              />
            ) : (
              <section className="wc26-fgc-groups-section mt-4">
                <div className="wc26-fgc-groups-head">
                  <h2 className="wc26-fgc-groups-title">GRUPOS DEL MUNDIAL</h2>
                  {daysUntil !== null ? (
                    <span className="wc26-fgc-countdown">
                      <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />
                      FALTAN {daysUntil} {daysUntil === 1 ? 'DÍA' : 'DÍAS'}
                    </span>
                  ) : null}
                </div>
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

        {selectedGroup && overall.pending > 0 ? (
          <div className="wc26-fixture-sticky-spacer" aria-hidden="true" />
        ) : null}
        {selectedGroup && overall.pending > 0 ? (
          <button type="button" className="wc26-fixture-sticky-cta" onClick={handleCompletePredictions}>
            Completar predicciones
          </button>
        ) : null}
      </div>

      <div className="wc26-fixture-page hidden space-y-6 md:block">
        {!selectedGroup && showGameCenter ? <FixturePlayHeader points={myPoints} /> : null}

        {selectedGroup ? (
          <div className="wc26-fixture-hero-header p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#22C55E]">Centro del juego</p>
            <h1 className="mt-1 text-3xl font-extrabold text-white">Grupo {selectedGroup}</h1>
          </div>
        ) : showGameCenter ? (
          <FixtureGameCenter overall={overall} predictions={predictions} matches={matches} />
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
            {!selectedGroup ? (
              <section className="wc26-fgc-groups-section">
                <div className="wc26-fgc-groups-head">
                  <h2 className="wc26-fgc-groups-title">GRUPOS DEL MUNDIAL</h2>
                  {daysUntil !== null ? (
                    <span className="wc26-fgc-countdown">
                      <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />
                      FALTAN {daysUntil} {daysUntil === 1 ? 'DÍA' : 'DÍAS'}
                    </span>
                  ) : null}
                </div>
              </section>
            ) : null}
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
