import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FixtureBoard, FixtureGroupHub, MatchPredictionModal } from '../../components/worldcup'
import { DataState } from '../../components/ui/DataState'
import { useWorldCupMatches, usePredictions } from '../../useWorldCupData'
import { useAuth } from '../../lib/auth'
import { useSavePrediction } from '../../hooks/useSavePrediction'
import { computeOverallProgress } from '../../utils/predictionProgress'
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
  const savePrediction = useSavePrediction(user?.id)
  const predictionSet = useMemo(() => new Set(predictions.map(p => p.matchId)), [predictions])
  const overall = useMemo(() => computeOverallProgress(matches, predictionSet), [matches, predictionSet])

  const openPredict = (match: Match) => {
    if (!user?.id) {
      navigate('/login')
      return
    }
    setPredictMatch(match)
  }

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
          result: (payload.result as 'home' | 'draw' | 'away') ?? 'home',
          homeScore: payload.exactScore?.home ?? 0,
          awayScore: payload.exactScore?.away ?? 0,
          firstScorerId: payload.firstScorer,
          mvpId: payload.mvp,
        })
      }}
    />
  )

  return (
    <>
      <div className="md:hidden">
        <header className="wc26-fixture-hero-header mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FFD700]">Centro del juego</p>
          <h1 className="mt-1 text-2xl font-extrabold text-white">
            {selectedGroup ? `Grupo ${selectedGroup}` : 'Fixture'}
          </h1>
          <p className="mt-1 text-sm text-white/75">
            {selectedGroup ? 'Predecí los partidos de tu grupo' : 'Elegí un grupo · Predecí · Competí'}
          </p>
          {user?.id && !selectedGroup && overall.total > 0 && (
            <p className="mt-3 text-xs font-bold text-white/60">
              {overall.predicted}/{overall.total} partidos · {overall.percent}% · hasta {overall.remainingPoints} pts posibles
            </p>
          )}
        </header>

        {isLoading && <DataState isLoading loadingMessage="Cargando fixture..." />}
        {(isError || error) && (
          <DataState isError errorMessage="No pudimos cargar los partidos." onRetry={() => refetch()} />
        )}
        {!isLoading && !isError && (
          <FixtureGroupHub
            matches={matches}
            predictions={predictions}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
            onPredict={openPredict}
          />
        )}
      </div>

      <div className="hidden space-y-6 md:block">
        <div className="wc26-fixture-hero-header p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FFD700]">Centro del juego</p>
          <h1 className="mt-1 text-3xl font-extrabold text-white">Fixture Mundial 2026</h1>
          <p className="mt-2 text-sm text-white/70">Grupos, predicciones y progreso del torneo.</p>
        </div>

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
              onSelectGroup={setSelectedGroup}
              onPredict={openPredict}
            />
            <FixtureBoard matches={matches} title="Calendario completo" onMatchClick={id => navigate(`/matches/${id}`)} />
          </>
        )}
      </div>

      {modal}
    </>
  )
}
