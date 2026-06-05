// Match Prediction Modal - Complete prediction form

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, Clock, X, Search, Check, Trophy, ArrowRight, Minus, Plus } from 'lucide-react'
import { TeamCrest } from './TeamCrest'
import { PlayerAvatar } from './PlayerAvatar'
import type { Match, Player, Prediction } from '../../types/worldcup'
import type { PredictionResult } from '../../types/api'
import { useMatchPlayers } from '../../useWorldCupData'
import { useAppToast } from '../ui/ToastProvider'
import { MAX_POINTS_PER_MATCH } from '../../utils/predictionProgress'
import {
  getResultLabel,
  getWinnerFromScore,
} from '../../utils/predictionValidation'

type Step = 'score' | 'scorer' | 'mvp' | 'review'
const STEPS: Step[] = ['score', 'scorer', 'mvp', 'review']

const PENDING_HOME = 'pending-home'
const PENDING_AWAY = 'pending-away'

/** Solo los IDs reales se persisten; los placeholders quedan como undefined. */
const isRealPlayerId = (id: string) => !!id && id !== PENDING_HOME && id !== PENDING_AWAY

function attackRank(pos: string | null): number {
  const p = (pos ?? '').toLowerCase()
  if (p.includes('strik') || p.includes('forward') || p.includes('delant') || /\b(cf|st)\b/.test(p)) return 0
  if (p.includes('wing') || p.includes('extrem') || /\b(lw|rw)\b/.test(p)) return 1
  if ((p.includes('att') || p.includes('ofens')) && p.includes('mid')) return 2
  if (p.includes('mid') || p.includes('medio')) return 3
  if (p.includes('def') || p.includes('back')) return 4
  if (p.includes('goal') || p.includes('keeper') || p.includes('arquer') || /\bgk\b/.test(p)) return 5
  return 3
}

function scorerSort(a: Player, b: Player): number {
  const ra = attackRank(a.position)
  const rb = attackRank(b.position)
  if (ra !== rb) return ra - rb
  if ((b.goals ?? 0) !== (a.goals ?? 0)) return (b.goals ?? 0) - (a.goals ?? 0)
  return (b.rating ?? 0) - (a.rating ?? 0)
}

function mvpSort(a: Player, b: Player): number {
  if ((b.rating ?? 0) !== (a.rating ?? 0)) return (b.rating ?? 0) - (a.rating ?? 0)
  if ((b.goals ?? 0) !== (a.goals ?? 0)) return (b.goals ?? 0) - (a.goals ?? 0)
  if ((b.marketValue ?? 0) !== (a.marketValue ?? 0)) return (b.marketValue ?? 0) - (a.marketValue ?? 0)
  return (b.appearances ?? 0) - (a.appearances ?? 0)
}

interface MatchPredictionModalProps {
  match: Match
  isOpen: boolean
  onClose: () => void
  onSave: (prediction: {
    matchId: string
    result: PredictionResult
    exactScore: { home: number; away: number }
    firstScorer?: string
    mvp?: string
  }) => Promise<void>
  existingPrediction?: Partial<Prediction>
}

function FallbackOption({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-all ${
        active
          ? 'bg-sky-500/15 ring-2 ring-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.25)]'
          : 'bg-white/5 ring-1 ring-white/10 hover:bg-white/10'
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{label}</p>
        {hint && <p className="truncate text-[11px] font-medium text-white/45">{hint}</p>}
      </div>
      {active && (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-400 text-night-900">
          <Check className="h-3.5 w-3.5 text-[#04121f]" />
        </span>
      )}
    </button>
  )
}

function ScoreDial({
  value,
  onChange,
  team,
  align,
}: {
  value: number
  onChange: (next: number) => void
  team: { flag?: string | null; code: string; name: string }
  align: 'left' | 'right'
}) {
  const dec = () => onChange(Math.max(0, value - 1))
  const inc = () => onChange(Math.min(9, value + 1))

  return (
    <div className={`wc26-predict-score-side wc26-predict-score-side--${align}`}>
      <div className="wc26-predict-score-side__team">
        <div className="wc26-predict-score-side__crest">
          <TeamCrest flag={team.flag} code={team.code} name={team.name} size="md" />
        </div>
        <p className="wc26-predict-score-side__name">{team.name}</p>
        <span className="wc26-predict-score-side__code">{team.code}</span>
      </div>
      <div className="wc26-predict-score-dial">
        <button type="button" onClick={dec} className="wc26-predict-score-dial__btn" aria-label={`Menos goles ${team.name}`}>
          <Minus className="h-4 w-4" />
        </button>
        <motion.span
          key={value}
          initial={{ scale: 0.82, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          className="wc26-predict-score-dial__value"
        >
          {value}
        </motion.span>
        <button type="button" onClick={inc} className="wc26-predict-score-dial__btn" aria-label={`Más goles ${team.name}`}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function PlayerRow({
  player,
  teamCode,
  selected,
  onSelect,
}: {
  player: Player
  teamCode: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
        selected
          ? 'bg-sky-500/15 ring-2 ring-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.25)]'
          : 'bg-white/5 ring-1 ring-white/10 hover:bg-white/10'
      }`}
    >
      <PlayerAvatar photo={player.photo} photoUrl={player.photoUrl} name={player.name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{player.name}</p>
        <p className="truncate text-[11px] font-medium text-white/50">
          {teamCode}
          {player.position ? ` · ${player.position}` : ''}
        </p>
      </div>
      {player.shirtNumber != null && (
        <span className="shrink-0 text-xs font-black text-white/40">#{player.shirtNumber}</span>
      )}
      {selected && (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-400">
          <Check className="h-3.5 w-3.5 text-[#04121f]" />
        </span>
      )}
    </button>
  )
}

function PlayerPicker({
  players,
  loading,
  selectedId,
  onSelect,
  mode,
  homeTeamId,
  homeCode,
  awayCode,
}: {
  players: Player[]
  loading: boolean
  selectedId: string
  onSelect: (id: string) => void
  mode: 'scorer' | 'mvp'
  homeTeamId: string
  homeCode: string
  awayCode: string
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'home' | 'away'>('all')

  const codeOf = (p: Player) => (p.teamId === homeTeamId ? homeCode : awayCode)
  const noneLabel = mode === 'scorer' ? 'Sin goleador / No elegir' : 'No elegir MVP'

  if (loading) {
    return <p className="p-4 text-center text-sm text-white/50">Cargando planteles...</p>
  }

  if (players.length === 0) {
    const opts =
      mode === 'scorer'
        ? [
            { id: '', label: 'Sin goleador', hint: 'No predecir goleador' },
            { id: PENDING_HOME, label: 'Goleador local por definir', hint: homeCode },
            { id: PENDING_AWAY, label: 'Goleador visitante por definir', hint: awayCode },
          ]
        : [
            { id: '', label: 'No elegir MVP', hint: 'Dejar sin elegir' },
            { id: PENDING_HOME, label: 'MVP local por definir', hint: homeCode },
            { id: PENDING_AWAY, label: 'MVP visitante por definir', hint: awayCode },
          ]
    return (
      <div className="space-y-2">
        {opts.map(o => (
          <FallbackOption
            key={o.id || 'none'}
            active={selectedId === o.id}
            label={o.label}
            hint={o.hint}
            onClick={() => onSelect(o.id)}
          />
        ))}
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] font-medium leading-relaxed text-white/55">
          {mode === 'scorer'
            ? 'Cuando el plantel esté disponible podrás elegir un jugador específico.'
            : 'El MVP es opcional. Podés dejarlo sin elegir.'}
        </p>
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const matchQuery = (p: Player) =>
    !q ||
    p.name.toLowerCase().includes(q) ||
    (p.position ?? '').toLowerCase().includes(q) ||
    codeOf(p).toLowerCase().includes(q)

  const searchBar = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar jugador..."
        className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/35 focus:border-sky-400/50 focus:outline-none"
      />
    </div>
  )

  const noneOption = (
    <FallbackOption active={selectedId === ''} label={noneLabel} onClick={() => onSelect('')} />
  )

  if (mode === 'scorer') {
    const homePlayers = players.filter(p => p.teamId === homeTeamId && matchQuery(p)).sort(scorerSort)
    const awayPlayers = players.filter(p => p.teamId !== homeTeamId && matchQuery(p)).sort(scorerSort)
    const renderGroup = (label: string, list: Player[]) =>
      list.length > 0 ? (
        <div key={label}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/40">{label}</p>
          <div className="space-y-1.5">
            {list.map(p => (
              <PlayerRow
                key={p.id}
                player={p}
                teamCode={codeOf(p)}
                selected={selectedId === p.id}
                onSelect={() => onSelect(p.id)}
              />
            ))}
          </div>
        </div>
      ) : null

    return (
      <div className="space-y-3">
        {searchBar}
        {noneOption}
        <div className="wc26-player-scroll max-h-[320px] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
          {renderGroup(homeCode, homePlayers)}
          {renderGroup(awayCode, awayPlayers)}
          {homePlayers.length === 0 && awayPlayers.length === 0 && (
            <p className="p-4 text-center text-sm text-white/45">Sin resultados para “{query}”.</p>
          )}
        </div>
      </div>
    )
  }

  let list = players.filter(matchQuery)
  if (filter === 'home') list = list.filter(p => p.teamId === homeTeamId)
  if (filter === 'away') list = list.filter(p => p.teamId !== homeTeamId)
  list = [...list].sort(mvpSort)

  const filters: { id: typeof filter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'home', label: homeCode },
    { id: 'away', label: awayCode },
  ]

  return (
    <div className="space-y-3">
      {searchBar}
      <div className="flex gap-1.5">
        {filters.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-all ${
              filter === f.id ? 'bg-sky-500/20 text-white ring-1 ring-sky-400/50' : 'bg-white/5 text-white/55'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {noneOption}
      <div className="wc26-player-scroll max-h-[320px] space-y-1.5 overflow-y-auto overflow-x-hidden pr-1">
        {list.length === 0 ? (
          <p className="p-4 text-center text-sm text-white/45">Sin resultados.</p>
        ) : (
          list.map(p => (
            <PlayerRow
              key={p.id}
              player={p}
              teamCode={codeOf(p)}
              selected={selectedId === p.id}
              onSelect={() => onSelect(p.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export function MatchPredictionModal({
  match,
  isOpen,
  onClose,
  onSave,
  existingPrediction,
}: MatchPredictionModalProps) {
  const homeTeam = match.homeTeam
  const awayTeam = match.awayTeam

  const [step, setStep] = useState<Step>(existingPrediction ? 'review' : 'score')
  const [homeScore, setHomeScore] = useState(
    existingPrediction?.exactScore?.home ?? existingPrediction?.predictedHomeScore ?? 1
  )
  const [awayScore, setAwayScore] = useState(
    existingPrediction?.exactScore?.away ?? existingPrediction?.predictedAwayScore ?? 0
  )
  const [firstScorerId, setFirstScorerId] = useState(existingPrediction?.predictedFirstScorerId || '')
  const [mvpId, setMvpId] = useState(existingPrediction?.predictedMvpId || '')
  const [isLoading, setIsLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()

  const { data: matchPlayers = [], isLoading: playersLoading } = useMatchPlayers(
    match.homeTeamId,
    match.awayTeamId
  )

  const { showToast } = useAppToast()

  const derivedResult = useMemo(
    () => getWinnerFromScore(homeScore, awayScore),
    [homeScore, awayScore]
  )

  useEffect(() => {
    if (!isOpen) return
    setSaved(false)
    setSaveError(null)
    setStep(existingPrediction ? 'review' : 'score')
    document.body.classList.add('wc26-modal-open')
    return () => document.body.classList.remove('wc26-modal-open')
  }, [isOpen, existingPrediction])

  if (!homeTeam || !awayTeam) return null

  const describeSelection = (id: string, kind: 'scorer' | 'mvp') => {
    if (id === PENDING_HOME) return `Por definir (${homeTeam.code})`
    if (id === PENDING_AWAY) return `Por definir (${awayTeam.code})`
    if (!id) return kind === 'scorer' ? 'Sin goleador' : 'Sin elegir'
    return matchPlayers.find(p => p.id === id)?.name ?? 'Sin elegir'
  }
  const stepIndex = STEPS.indexOf(step)
  const kickoffDate = new Date(match.kickoff)
  const fmtDate = kickoffDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtTime = kickoffDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

  const handleSave = async () => {
    setSaveError(null)
    setIsLoading(true)
    try {
      await onSave({
        matchId: match.id,
        result: derivedResult,
        exactScore: { home: homeScore, away: awayScore },
        firstScorer: isRealPlayerId(firstScorerId) ? firstScorerId : undefined,
        mvp: isRealPlayerId(mvpId) ? mvpId : undefined,
      })
      showToast('✔ Predicción guardada')
      setSaved(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar la predicción.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="wc26-predict-backdrop fixed inset-0 z-[60]"
          />

          <div className="wc26-predict-modal-shell fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="wc26-predict-modal pointer-events-auto flex max-h-[min(92vh,720px)] w-full max-w-[min(95vw,32rem)] flex-col overflow-hidden box-border"
              onClick={e => e.stopPropagation()}
            >
              <header className="wc26-predict-modal__header shrink-0 px-5 pb-4 pt-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:gap-5">
                    <div className="wc26-predict-match-team">
                      <div className="wc26-predict-match-team__crest">
                        <TeamCrest flag={homeTeam.flag} code={homeTeam.code} name={homeTeam.name} size="lg" />
                      </div>
                      <p className="wc26-predict-match-team__name">{homeTeam.name}</p>
                      <span className="wc26-predict-match-team__code">{homeTeam.code}</span>
                    </div>
                    <div className="wc26-predict-vs">
                      <span>VS</span>
                    </div>
                    <div className="wc26-predict-match-team">
                      <div className="wc26-predict-match-team__crest">
                        <TeamCrest flag={awayTeam.flag} code={awayTeam.code} name={awayTeam.name} size="lg" />
                      </div>
                      <p className="wc26-predict-match-team__name">{awayTeam.name}</p>
                      <span className="wc26-predict-match-team__code">{awayTeam.code}</span>
                    </div>
                  </div>
                  <button type="button" onClick={onClose} className="wc26-header-icon-btn shrink-0" aria-label="Cerrar">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="wc26-predict-meta">
                  <span className="wc26-predict-meta__chip">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {fmtDate}
                  </span>
                  <span className="wc26-predict-meta__chip">
                    <Clock className="h-3.5 w-3.5" />
                    {fmtTime}
                  </span>
                  {match.group && (
                    <span className="wc26-predict-meta__chip wc26-predict-meta__chip--group">Grupo {match.group}</span>
                  )}
                </div>
                {!saved && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-white/55">
                      <span>
                        Paso {stepIndex + 1} de {STEPS.length}
                      </span>
                      <span className="text-wc26-yellow">{Math.round(((stepIndex + 1) / STEPS.length) * 100)}%</span>
                    </div>
                    <div className="wc26-predict-progress">
                      <motion.div
                        className="wc26-predict-progress__fill"
                        animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
                        transition={{ duration: 0.25 }}
                      />
                    </div>
                  </div>
                )}
              </header>

              {saved && (
                <div className="wc26-predict-modal__body min-h-0 flex-1 overflow-y-auto px-5 py-5">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col items-center text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 18 }}
                      className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-green-600 shadow-[0_0_30px_rgba(16,185,129,0.45)]"
                    >
                      <Check className="h-9 w-9 text-white" strokeWidth={3} />
                    </motion.div>
                    <p className="mt-4 text-lg font-black text-white">¡Predicción guardada!</p>
                    <p className="text-sm text-white/55">Ya estás compitiendo en este partido</p>

                    <div className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-white/5 px-4 py-4 ring-1 ring-white/10">
                      <div className="flex flex-col items-center gap-1.5">
                        <TeamCrest flag={homeTeam.flag} code={homeTeam.code} name={homeTeam.name} size="md" />
                        <span className="max-w-[5rem] truncate text-[11px] font-bold text-white/80">{homeTeam.code}</span>
                      </div>
                      <span className="text-3xl font-black tabular-nums text-wc26-yellow">
                        {homeScore} - {awayScore}
                      </span>
                      <div className="flex flex-col items-center gap-1.5">
                        <TeamCrest flag={awayTeam.flag} code={awayTeam.code} name={awayTeam.name} size="md" />
                        <span className="max-w-[5rem] truncate text-[11px] font-bold text-white/80">{awayTeam.code}</span>
                      </div>
                    </div>

                    <div className="mt-3 w-full space-y-2 rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-white/55">Resultado</span>
                        <span className="font-bold text-white">{getResultLabel(derivedResult, homeTeam.code, awayTeam.code)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/55">Primer goleador</span>
                        <span className={`font-bold ${isRealPlayerId(firstScorerId) ? 'text-white' : 'text-white/50'}`}>
                          {describeSelection(firstScorerId, 'scorer')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/55">MVP</span>
                        <span className={`font-bold ${isRealPlayerId(mvpId) ? 'text-white' : 'text-white/50'}`}>
                          {describeSelection(mvpId, 'mvp')}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400/15 to-yellow-500/10 px-4 py-3 ring-1 ring-amber-400/25">
                      <Trophy className="h-4 w-4 text-wc26-yellow" />
                      <span className="text-sm font-bold text-white">Hasta {MAX_POINTS_PER_MATCH} pts posibles</span>
                    </div>
                  </motion.div>
                </div>
              )}

              {saved && (
                <footer className="wc26-predict-modal__footer shrink-0 flex gap-3 px-5 py-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="wc26-predict-btn wc26-predict-btn--ghost flex-1"
                  >
                    Listo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      navigate('/predictions')
                    }}
                    className="wc26-predict-btn wc26-predict-btn--cta flex-[1.4] inline-flex items-center justify-center gap-1.5"
                  >
                    Ver mis predicciones
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </footer>
              )}

              {!saved && (
              <>
              <div className="wc26-predict-modal__body min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-5">
              <AnimatePresence mode="wait">
                {step === 'score' && (
                  <motion.div
                    key="score"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="wc26-predict-score-step space-y-5"
                  >
                    <div className="text-center">
                      <h3 className="text-xl font-black tracking-tight text-white">Marcador exacto</h3>
                      <p className="mt-1 text-sm text-white/55">El ganador se infiere automáticamente del marcador</p>
                    </div>

                    <div className="wc26-predict-scoreboard">
                      <span className="wc26-predict-scoreboard__shine" aria-hidden="true" />
                      <ScoreDial
                        value={homeScore}
                        onChange={setHomeScore}
                        team={homeTeam}
                        align="left"
                      />
                      <div className="wc26-predict-scoreboard__center" aria-hidden="true">
                        <span className="wc26-predict-scoreboard__colon">:</span>
                      </div>
                      <ScoreDial
                        value={awayScore}
                        onChange={setAwayScore}
                        team={awayTeam}
                        align="right"
                      />
                    </div>

                    <div className="wc26-predict-score-preview">
                      <span className="wc26-predict-score-preview__label">Resultado inferido</span>
                      <span className="wc26-predict-score-preview__value is-ok">
                        {getResultLabel(derivedResult, homeTeam.code, awayTeam.code)}
                      </span>
                    </div>

                    <div className="wc26-predict-quick-scores">
                      <p className="wc26-predict-quick-scores__title">Marcadores frecuentes</p>
                      <div className="wc26-predict-quick-scores__row">
                        {[
                          { h: 1, a: 0 },
                          { h: 2, a: 1 },
                          { h: 1, a: 1 },
                          { h: 0, a: 0 },
                          { h: 2, a: 0 },
                        ].map(pick => {
                          const active = homeScore === pick.h && awayScore === pick.a
                          return (
                            <button
                              key={`${pick.h}-${pick.a}`}
                              type="button"
                              onClick={() => {
                                setHomeScore(pick.h)
                                setAwayScore(pick.a)
                              }}
                              className={`wc26-predict-quick-score${active ? ' is-active' : ''}`}
                            >
                              {pick.h} - {pick.a}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 'scorer' && (
                  <motion.div key="scorer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div>
                      <h3 className="mb-2 text-lg font-extrabold text-white">Primer goleador</h3>
                      <p className="text-sm text-white/60">Elegí quién anota primero (opcional)</p>
                    </div>
                    <PlayerPicker
                      players={matchPlayers}
                      loading={playersLoading}
                      selectedId={firstScorerId}
                      onSelect={setFirstScorerId}
                      mode="scorer"
                      homeTeamId={match.homeTeamId}
                      homeCode={homeTeam.code}
                      awayCode={awayTeam.code}
                    />
                  </motion.div>
                )}

                {step === 'mvp' && (
                  <motion.div key="mvp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <div>
                      <h3 className="mb-2 text-lg font-extrabold text-white">Jugador destacado (MVP)</h3>
                      <p className="text-sm text-white/60">Elegí el mejor jugador del partido (opcional)</p>
                    </div>
                    <PlayerPicker
                      players={matchPlayers}
                      loading={playersLoading}
                      selectedId={mvpId}
                      onSelect={setMvpId}
                      mode="mvp"
                      homeTeamId={match.homeTeamId}
                      homeCode={homeTeam.code}
                      awayCode={awayTeam.code}
                    />
                  </motion.div>
                )}

                {step === 'review' && (
                  <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <h3 className="text-lg font-extrabold text-white">Confirmá tu predicción</h3>
                    <div className="wc26-predict-review space-y-3 rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">Marcador:</span>
                        <span className="font-bold text-lg text-wc26-yellow">{homeScore} - {awayScore}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">Resultado:</span>
                        <span className="font-bold text-green-300">
                          {getResultLabel(derivedResult, homeTeam.code, awayTeam.code)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">Primer goleador:</span>
                        <span className={`font-bold ${isRealPlayerId(firstScorerId) ? 'text-white' : 'text-white/50'}`}>
                          {describeSelection(firstScorerId, 'scorer')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">MVP:</span>
                        <span className={`font-bold ${isRealPlayerId(mvpId) ? 'text-white' : 'text-white/50'}`}>
                          {describeSelection(mvpId, 'mvp')}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {saveError && (
                <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {saveError}
                </p>
              )}
              </div>

              <footer className="wc26-predict-modal__footer shrink-0 flex gap-3 px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    if (stepIndex > 0) setStep(STEPS[stepIndex - 1])
                  }}
                  disabled={stepIndex === 0}
                  className="wc26-predict-btn wc26-predict-btn--ghost flex-1 disabled:opacity-40"
                >
                  Atrás
                </button>

                {step !== 'review' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1])
                    }}
                    className="wc26-predict-btn wc26-predict-btn--primary flex-1"
                  >
                    Siguiente
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isLoading || match.isLocked || match.status !== 'scheduled'}
                    className="wc26-predict-btn wc26-predict-btn--cta flex-[1.4] disabled:opacity-50"
                  >
                    {isLoading ? 'Guardando…' : 'Guardar predicción'}
                  </button>
                )}
              </footer>
              </>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
