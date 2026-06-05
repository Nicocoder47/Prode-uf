import { useMemo, useState } from 'react'
import { Clock, Lock, CheckCircle2 } from 'lucide-react'
import { MatchPredictionModal, TeamCrest } from '../../components/worldcup'
import { useWorldCupMatches, usePredictions } from '../../useWorldCupData'
import { useAuth } from '../../lib/auth'
import { useSavePrediction } from '../../hooks/useSavePrediction'
import { EMPTY } from '../../utils/emptyState'
import { getResultLabel, isPredictionCoherent } from '../../utils/predictionValidation'
import type { Match, Prediction } from '../../types/worldcup'

type PredTab = 'pendientes' | 'bloqueadas' | 'puntuadas'

const TABS: { id: PredTab; label: string; icon: typeof Clock }[] = [
  { id: 'pendientes', label: 'Pendientes', icon: Clock },
  { id: 'bloqueadas', label: 'Bloqueadas', icon: Lock },
  { id: 'puntuadas', label: 'Puntuadas', icon: CheckCircle2 },
]

function EmptyBox({ children }: { children: React.ReactNode }) {
  return <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">{children}</p>
}

function PredTabs({ active, onChange }: { active: PredTab; onChange: (t: PredTab) => void }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-[20px] wc26-glass p-1 scrollbar-none">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex shrink-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-extrabold transition-all ${
              isActive ? 'bg-white/12 text-white shadow-md' : 'text-white/55'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: 'PENDIENTE', className: 'bg-sky-500/15 text-sky-200' },
  locked: { label: 'BLOQUEADA', className: 'bg-orange-500/15 text-orange-200' },
  scored: { label: 'PUNTUADA', className: 'bg-emerald-500/15 text-emerald-200' },
}

function TeamFlag({ flag, code, name }: { flag: string; code: string; name?: string }) {
  return <TeamCrest flag={flag} code={code} name={name} size="md" />
}

function PredictionCard({
  prediction,
  match,
  onEdit,
}: {
  prediction: Prediction
  match: Match
  onEdit?: () => void
}) {
  const badge = STATUS_BADGE[prediction.status] ?? STATUS_BADGE.pending
  const canEdit =
    prediction.status === 'pending' && !match.isLocked && match.status === 'scheduled' && onEdit
  const home = match.homeTeam
  const away = match.awayTeam
  if (!home || !away) return null

  const resultLabel = getResultLabel(prediction.result, home.code, away.code)
  const incoherent =
    prediction.result &&
    prediction.exactScore &&
    !isPredictionCoherent(prediction.result, prediction.exactScore.home, prediction.exactScore.away)

  return (
    <div className="wc26-card overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide ${badge.className}`}>
          {badge.label}
        </span>
        {prediction.status === 'scored' && (
          <span className="text-sm font-extrabold text-wc26-yellow">
            {prediction.points > 0 ? `+${prediction.points} pts` : '0 pts'}
          </span>
        )}
      </div>

      <p className="mb-3 text-center text-xs font-semibold text-white/70">
        {resultLabel}
        {prediction.exactScore ? ` · Marcador ${prediction.exactScore.home}-${prediction.exactScore.away}` : ''}
      </p>

      {incoherent && (
        <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1.5 text-center text-[11px] text-amber-100">
          Resultado y marcador no coinciden. Editá antes del inicio del partido.
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="flex flex-1 flex-col items-center gap-1">
          <TeamFlag flag={home.flag} code={home.code} name={home.name} />
          <span className="text-xs font-bold text-white">{home.name || home.code}</span>
        </div>
        <div className="text-center">
          {prediction.exactScore ? (
            <>
              <p className="text-xl font-extrabold text-white">
                {prediction.exactScore.home} - {prediction.exactScore.away}
              </p>
              <p className="text-[10px] font-semibold uppercase text-white/45">Tu marcador</p>
            </>
          ) : (
            <p className="text-sm font-semibold text-white/50">Sin marcador</p>
          )}
        </div>
        <div className="flex flex-1 flex-col items-center gap-1">
          <TeamFlag flag={away.flag} code={away.code} name={away.name} />
          <span className="text-xs font-bold text-white">{away.name || away.code}</span>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-white/50">
        {new Date(match.kickoff).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
        {match.group ? ` · Grupo ${match.group}` : ''}
      </p>

      {canEdit && (
        <button type="button" onClick={onEdit} className="wc26-btn-blue mt-4 w-full py-3 text-xs">
          Editar predicción
        </button>
      )}
    </div>
  )
}

export default function PredictionsPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<PredTab>('pendientes')
  const [predictMatch, setPredictMatch] = useState<Match | null>(null)

  const { data: matches = [] } = useWorldCupMatches()
  const { data: predictions = [], isLoading } = usePredictions(user?.id)
  const savePrediction = useSavePrediction(user?.id)

  const stats = useMemo(() => {
    const pending = predictions.filter(p => p.status === 'pending').length
    const locked = predictions.filter(p => p.status === 'locked').length
    const scored = predictions.filter(p => p.status === 'scored')
    const points = scored.reduce((s, p) => s + p.points, 0)
    const hits = scored.filter(p => p.points > 0).length
    return { pending, locked, points, hits }
  }, [predictions])

  const filtered = useMemo(() => {
    switch (tab) {
      case 'pendientes':
        return predictions.filter(p => p.status === 'pending')
      case 'bloqueadas':
        return predictions.filter(p => p.status === 'locked')
      case 'puntuadas':
        return predictions.filter(p => p.status === 'scored')
      default:
        return predictions
    }
  }, [predictions, tab])

  const openEdit = (match: Match) => setPredictMatch(match)

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

  if (!user?.id) {
    return (
      <div className="space-y-4">
        <PageHeader />
        <EmptyBox>{EMPTY.login}</EmptyBox>
      </div>
    )
  }

  return (
    <>
      <PageHeader />

      {/* Resumen */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="wc26-card p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-wc26-text/40">Pendientes</p>
          <p className="mt-1 text-2xl font-extrabold text-wc26-blue">{stats.pending}</p>
        </div>
        <div className="wc26-card p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-wc26-text/40">Puntos</p>
          <p className="mt-1 text-2xl font-extrabold text-wc26-orange">{stats.points}</p>
        </div>
        <div className="wc26-card p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-wc26-text/40">Aciertos</p>
          <p className="mt-1 text-2xl font-extrabold text-wc26-green">{stats.hits}</p>
        </div>
      </div>

      <PredTabs active={tab} onChange={setTab} />

      {isLoading && <EmptyBox>Cargando predicciones...</EmptyBox>}

      {!isLoading && filtered.length === 0 && (
        <EmptyBox>
          {tab === 'pendientes'
            ? 'No tenés predicciones pendientes.'
            : tab === 'bloqueadas'
              ? 'No tenés predicciones bloqueadas.'
              : 'Todavía no hay predicciones puntuadas.'}
        </EmptyBox>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map(pred => {
            const match = matches.find(m => m.id === pred.matchId)
            if (!match) return null
            return (
              <PredictionCard
                key={pred.id}
                prediction={pred}
                match={match}
                onEdit={
                  pred.status === 'pending' && !matches.find(m => m.id === pred.matchId)?.isLocked
                    ? () => openEdit(match)
                    : undefined
                }
              />
            )
          })}
        </div>
      )}

      {/* Desktop hint */}
      <div className="mt-8 hidden md:block">
        <div className="wc26-card p-5">
          <p className="text-sm text-wc26-text/55">
            Tus predicciones se bloquean automáticamente antes del inicio de cada partido. Los puntos se calculan al
            finalizar el encuentro.
          </p>
        </div>
      </div>

      {modal}
    </>
  )
}

function PageHeader() {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-wc26-blue">Mis apuestas</p>
      <h1 className="text-2xl font-extrabold text-wc26-text md:text-3xl">Predicciones</h1>
      <p className="mt-1 text-sm text-wc26-text/55">Gestioná tus pronósticos del Mundial</p>
    </div>
  )
}
