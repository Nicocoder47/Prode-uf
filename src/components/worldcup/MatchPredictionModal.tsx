// Match Prediction Modal - Complete prediction form

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, Clock, X, Check, Trophy, ArrowRight, Minus, Plus } from 'lucide-react'
import { TeamCrest } from './TeamCrest'
import type { Match, Prediction, Team } from '../../types/worldcup'
import type { PredictionResult } from '../../types/api'
import { useAppToast } from '../ui/ToastProvider'
import { getNextPredictableMatch, maxPointsForMatch } from '../../utils/predictionProgress'
import { mapPredictionSaveError } from '../../utils/predictionSaveErrors'
import {
  isKnockoutMatch,
  validateKnockoutPrediction,
  KNOCKOUT_SCORING,
  isKnockoutDrawAfterEt,
  isEtScoreFilled,
  cumulativeTotal,
  type PenaltyWinnerPick,
} from '../../constants/knockoutScoring'
import {
  getResultLabel,
  getWinnerFromScore,
} from '../../utils/predictionValidation'
import { teamDisplayName } from '../../utils/teamDisplay'

type Step = 'score' | 'review'
const STEPS: Step[] = ['score', 'review']

interface MatchPredictionModalProps {
  match: Match
  isOpen: boolean
  onClose: () => void
  onSave: (prediction: {
    matchId: string
    result: PredictionResult
    exactScore: { home: number; away: number }
    etScore?: { home: number; away: number } | null
    penaltyWinner?: PenaltyWinnerPick | null
  }) => Promise<void>
  existingPrediction?: Partial<Prediction>
  allMatches?: Match[]
  onContinueNext?: (next: Match) => void
}

function CompactScoreControl({
  value,
  onChange,
  optional = false,
  label,
}: {
  value: number | null
  onChange: (next: number | null) => void
  optional?: boolean
  label: string
}) {
  const filled = value !== null
  const display = filled ? value : '—'

  const dec = () => {
    if (optional) {
      if (value === null) return
      if (value <= 0) onChange(null)
      else onChange(value - 1)
      return
    }
    onChange(Math.max(0, (value ?? 0) - 1))
  }

  const inc = () => {
    if (optional) onChange(value === null ? 0 : Math.min(9, value + 1))
    else onChange(Math.min(9, (value ?? 0) + 1))
  }

  return (
    <div className="wc26-predict-compact-score">
      <button
        type="button"
        onClick={dec}
        className="wc26-predict-compact-score__btn"
        aria-label={`Menos goles ${label}`}
      >
        <Minus className="h-3 w-3" />
      </button>
      <motion.span
        key={display}
        initial={{ scale: 0.9, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`wc26-predict-compact-score__value${optional && !filled ? ' is-empty' : ''}`}
      >
        {display}
      </motion.span>
      <button
        type="button"
        onClick={inc}
        className="wc26-predict-compact-score__btn"
        aria-label={`Más goles ${label}`}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  )
}

function CompactPredictRow({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  onHomeChange,
  onAwayChange,
  optional = false,
}: {
  homeTeam: Team
  awayTeam: Team
  homeScore: number | null
  awayScore: number | null
  onHomeChange: (v: number | null) => void
  onAwayChange: (v: number | null) => void
  optional?: boolean
}) {
  const homeName = teamDisplayName(homeTeam)
  const awayName = teamDisplayName(awayTeam)

  return (
    <div className="wc26-predict-compact-row">
      <div className="wc26-predict-compact-row__side wc26-predict-compact-row__side--home">
        <TeamCrest flag={homeTeam.flag} code={homeTeam.code} name={homeName} size="xs" />
        <span className="wc26-predict-compact-row__name">{homeName}</span>
      </div>

      <div className="wc26-predict-compact-row__scores">
        <CompactScoreControl
          value={homeScore}
          onChange={onHomeChange}
          optional={optional}
          label={homeTeam.code}
        />
        <span className="wc26-predict-compact-row__vs" aria-hidden="true">
          VS
        </span>
        <CompactScoreControl
          value={awayScore}
          onChange={onAwayChange}
          optional={optional}
          label={awayTeam.code}
        />
      </div>

      <div className="wc26-predict-compact-row__side wc26-predict-compact-row__side--away">
        <span className="wc26-predict-compact-row__name">{awayName}</span>
        <TeamCrest flag={awayTeam.flag} code={awayTeam.code} name={awayName} size="xs" />
      </div>
    </div>
  )
}

function clearKnockoutExtras(
  setEtHome: (v: number | null) => void,
  setEtAway: (v: number | null) => void,
  setPenalty: (v: PenaltyWinnerPick | null) => void,
) {
  setEtHome(null)
  setEtAway(null)
  setPenalty(null)
}

export function MatchPredictionModal({
  match,
  isOpen,
  onClose,
  onSave,
  existingPrediction,
  allMatches = [],
  onContinueNext,
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
  const [etHomeScore, setEtHomeScore] = useState<number | null>(
    existingPrediction?.predictedEtHomeScore ?? null,
  )
  const [etAwayScore, setEtAwayScore] = useState<number | null>(
    existingPrediction?.predictedEtAwayScore ?? null,
  )
  const [penaltyWinner, setPenaltyWinner] = useState<PenaltyWinnerPick | null>(
    existingPrediction?.predictedPenaltyWinner ?? null
  )
  const [isLoading, setIsLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveHint, setSaveHint] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()

  const { showToast } = useAppToast()

  const nextMatch = useMemo(
    () => (allMatches.length > 0 ? getNextPredictableMatch(allMatches, match) : null),
    [allMatches, match],
  )

  const derivedResult = useMemo(
    () => getWinnerFromScore(homeScore, awayScore),
    [homeScore, awayScore]
  )

  const isKnockout = isKnockoutMatch(match)
  const isDrawAt90 = derivedResult === 'draw'
  const showKnockoutExtras = isKnockout && isDrawAt90
  const showPenaltyPick = showKnockoutExtras && isKnockoutDrawAfterEt(etHomeScore, etAwayScore)
  const pointsCap = maxPointsForMatch(match)
  const totalAfterEt = cumulativeTotal(homeScore, awayScore, etHomeScore, etAwayScore)

  const knockoutValidationError = useMemo(() => {
    if (!showKnockoutExtras) return null
    return validateKnockoutPrediction({
      homeScore,
      awayScore,
      etHomeScore,
      etAwayScore,
      penaltyWinner,
    })
  }, [showKnockoutExtras, homeScore, awayScore, etHomeScore, etAwayScore, penaltyWinner])

  useEffect(() => {
    if (!isOpen) return
    setSaved(false)
    setSaveError(null)
    setSaveHint(null)
    setStep(existingPrediction ? 'review' : 'score')
    setHomeScore(existingPrediction?.exactScore?.home ?? existingPrediction?.predictedHomeScore ?? 1)
    setAwayScore(existingPrediction?.exactScore?.away ?? existingPrediction?.predictedAwayScore ?? 0)
    setEtHomeScore(existingPrediction?.predictedEtHomeScore ?? null)
    setEtAwayScore(existingPrediction?.predictedEtAwayScore ?? null)
    setPenaltyWinner(existingPrediction?.predictedPenaltyWinner ?? null)
    document.body.classList.add('wc26-modal-open')
    return () => document.body.classList.remove('wc26-modal-open')
  }, [isOpen, existingPrediction, match.id])

  if (!homeTeam || !awayTeam) return null

  const stepIndex = STEPS.indexOf(step)
  const kickoffDate = new Date(match.kickoff)
  const fmtDate = kickoffDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtTime = kickoffDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

  const handleSave = async () => {
    setSaveError(null)
    setSaveHint(null)
    if (knockoutValidationError) {
      setSaveHint(knockoutValidationError)
      return
    }
    setIsLoading(true)
    try {
      await onSave({
        matchId: match.id,
        result: derivedResult,
        exactScore: { home: homeScore, away: awayScore },
        etScore:
          showKnockoutExtras && isEtScoreFilled(etHomeScore, etAwayScore)
            ? { home: etHomeScore, away: etAwayScore }
            : null,
        penaltyWinner: showPenaltyPick ? penaltyWinner : null,
      })

      if (nextMatch && onContinueNext) {
        showToast(
          match.group ? 'Predicción guardada · siguiente del grupo' : 'Predicción guardada · siguiente partido',
          'success',
        )
        onContinueNext(nextMatch)
        return
      }

      showToast('Predicción guardada', 'success')
      onClose()
    } catch (error) {
      const raw = error instanceof Error ? error.message : ''
      setSaveError(mapPredictionSaveError(raw))
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextStep = () => {
    setSaveError(null)
    setSaveHint(null)
    if (knockoutValidationError) {
      setSaveHint(knockoutValidationError)
      return
    }
    if (step === 'score' && nextMatch && onContinueNext) {
      void handleSave()
      return
    }
    if (stepIndex < STEPS.length - 1) {
      setStep(STEPS[stepIndex + 1])
      return
    }
    void handleSave()
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

          <div className="wc26-predict-modal-shell fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="wc26-predict-modal wc26-predict-modal--premium wc26-predict-modal--compact pointer-events-auto flex max-h-[min(90vh,680px)] w-full max-w-[min(95vw,32rem)] flex-col overflow-hidden box-border"
              onClick={e => e.stopPropagation()}
            >
              <header className="wc26-predict-modal__header shrink-0 px-3 pb-1.5 pt-2 sm:px-4 sm:pb-2 sm:pt-2.5">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2">
                    <div className="wc26-predict-match-team">
                      <div className="wc26-predict-match-team__crest">
                        <TeamCrest flag={homeTeam.flag} code={homeTeam.code} name={homeTeam.name} size="xs" premium />
                      </div>
                      <span className="wc26-predict-match-team__name">{teamDisplayName(homeTeam)}</span>
                    </div>
                    <div className="wc26-predict-vs">
                      <span>VS</span>
                    </div>
                    <div className="wc26-predict-match-team">
                      <div className="wc26-predict-match-team__crest">
                        <TeamCrest flag={awayTeam.flag} code={awayTeam.code} name={awayTeam.name} size="xs" premium />
                      </div>
                      <span className="wc26-predict-match-team__name">{teamDisplayName(awayTeam)}</span>
                    </div>
                  </div>
                  <button type="button" onClick={onClose} className="wc26-header-icon-btn shrink-0" aria-label="Cerrar">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="wc26-predict-meta">
                  <span className="wc26-predict-meta__chip">
                    <CalendarDays className="h-3 w-3" />
                    {fmtDate}
                  </span>
                  <span className="wc26-predict-meta__chip">
                    <Clock className="h-3 w-3" />
                    {fmtTime}
                  </span>
                  {match.group && (
                    <span className="wc26-predict-meta__chip wc26-predict-meta__chip--group">Grupo {match.group}</span>
                  )}
                </div>
                {!saved && (
                  <div className="mt-1">
                    <div className="wc26-predict-progress-labels mb-0.5 flex items-center justify-between text-[10px] font-bold text-white/55">
                      <span>
                        Paso {stepIndex + 1} de {STEPS.length}
                      </span>
                      <span className="text-wc26-yellow">{Math.round(((stepIndex + 1) / STEPS.length) * 100)}%</span>
                    </div>
                    <div className="wc26-predict-progress wc26-predict-progress--slim">
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
                      <span className="text-sm font-black text-white/80">{homeTeam.code}</span>
                      <span className="text-3xl font-black tabular-nums text-wc26-yellow">
                        {homeScore} - {awayScore}
                      </span>
                      <span className="text-sm font-black text-white/80">{awayTeam.code}</span>
                    </div>

                    <div className="mt-3 w-full space-y-2 rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-white/55">Resultado</span>
                        <span className="font-bold text-white">{getResultLabel(derivedResult, homeTeam.code, awayTeam.code)}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400/15 to-yellow-500/10 px-4 py-3 ring-1 ring-amber-400/25">
                      <Trophy className="h-4 w-4 text-wc26-yellow" />
                      <span className="text-sm font-bold text-white">Hasta {pointsCap} pts posibles</span>
                    </div>
                  </motion.div>
                </div>
              )}

              {saved && (
                <footer className="wc26-predict-modal__footer shrink-0 flex gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
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
                      navigate('/mis-predicciones')
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
              <div
                className="wc26-predict-modal__body min-h-0 flex-1 overflow-x-hidden overflow-y-hidden px-3 py-2 sm:px-4 sm:py-2.5"
              >
              <AnimatePresence mode="wait">
                {step === 'score' && (
                  <motion.div
                    key="score"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={`wc26-predict-score-step ${showKnockoutExtras ? 'space-y-1.5' : 'space-y-2'}`}
                  >
                    <div className="wc26-predict-section-head">
                      <h3 className="wc26-predict-step-title wc26-predict-step-title--compact wc26-predict-step-title--neon">
                        {isKnockout ? 'Predicción 90 minutos' : 'Marcador exacto'}
                      </h3>
                      <p className="wc26-predict-step-sub wc26-predict-step-sub--compact">
                        {isKnockout
                          ? `Hasta ${KNOCKOUT_SCORING.result90} pts por acertar el resultado de los 90'`
                          : 'El ganador se infiere del marcador'}
                      </p>
                    </div>

                    <CompactPredictRow
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      homeScore={homeScore}
                      awayScore={awayScore}
                      onHomeChange={v => {
                        if (v === null) return
                        setHomeScore(v)
                        if (v !== awayScore) {
                          clearKnockoutExtras(setEtHomeScore, setEtAwayScore, setPenaltyWinner)
                        }
                      }}
                      onAwayChange={v => {
                        if (v === null) return
                        setAwayScore(v)
                        if (homeScore !== v) {
                          clearKnockoutExtras(setEtHomeScore, setEtAwayScore, setPenaltyWinner)
                        }
                      }}
                    />

                    {!showKnockoutExtras && (
                      <p className="wc26-predict-inline-result">
                        <span className="wc26-predict-inline-result__label">Resultado</span>
                        <span className="wc26-predict-inline-result__value">
                          {getResultLabel(derivedResult, homeTeam.code, awayTeam.code)}
                        </span>
                      </p>
                    )}

                    {!showKnockoutExtras && (
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
                                if (pick.h !== pick.a) {
                                  clearKnockoutExtras(setEtHomeScore, setEtAwayScore, setPenaltyWinner)
                                }
                              }}
                              className={`wc26-predict-quick-score${active ? ' is-active' : ''}`}
                            >
                              {pick.h} - {pick.a}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    )}

                    <AnimatePresence>
                      {showKnockoutExtras && (
                        <motion.div
                          key="knockout-et"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="wc26-predict-knockout-section space-y-1.5">
                            <div className="wc26-predict-section-head">
                              <h3 className="wc26-predict-step-title wc26-predict-step-title--compact wc26-predict-step-title--section wc26-predict-step-title--neon">
                                Predicción del alargue
                              </h3>
                              <p className="wc26-predict-step-sub wc26-predict-step-sub--compact wc26-predict-et-help">
                                Marcá{' '}
                                <span className="wc26-predict-et-help__gold">solo los goles del alargue</span>.
                                Si también{' '}
                                <span className="wc26-predict-et-help__sky">termina empatado</span>, elegí quién clasifica por{' '}
                                <span className="wc26-predict-et-help__green">penales</span>.
                              </p>
                            </div>
                            <CompactPredictRow
                              homeTeam={homeTeam}
                              awayTeam={awayTeam}
                              homeScore={etHomeScore}
                              awayScore={etAwayScore}
                              optional
                              onHomeChange={v => {
                                setEtHomeScore(v)
                                if (v !== etAwayScore) setPenaltyWinner(null)
                              }}
                              onAwayChange={v => {
                                setEtAwayScore(v)
                                if (etHomeScore !== v) setPenaltyWinner(null)
                              }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {showPenaltyPick && (
                        <motion.div
                          key="knockout-pen"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="wc26-predict-knockout-section space-y-1.5">
                            <div className="wc26-predict-section-head">
                              <h3 className="wc26-predict-step-title wc26-predict-step-title--compact wc26-predict-step-title--section wc26-predict-step-title--neon">
                                Penales
                              </h3>
                              <p className="wc26-predict-step-sub wc26-predict-step-sub--compact">
                                Solo ganador · +{KNOCKOUT_SCORING.penaltyWinner} pts
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                              {(['home', 'away'] as const).map(side => {
                                const team = side === 'home' ? homeTeam : awayTeam
                                const active = penaltyWinner === side
                                return (
                                  <button
                                    key={side}
                                    type="button"
                                    onClick={() => setPenaltyWinner(side)}
                                    className={`wc26-predict-penalty-pick wc26-predict-penalty-pick--compact${active ? ' is-active' : ''}`}
                                  >
                                    <TeamCrest flag={team.flag} code={team.code} name={team.name} size="sm" />
                                    <span className="min-w-0 truncate">{teamDisplayName(team)}</span>
                                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-wc26-yellow" />}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {step === 'review' && (
                  <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <h3 className="wc26-predict-step-title wc26-predict-step-title--neon">Confirmá tu predicción</h3>
                    <div className="wc26-predict-review wc26-predict-review--premium space-y-3 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/60">Partido</span>
                        <span className="text-right text-sm font-bold text-white">
                          {homeTeam.code} vs {awayTeam.code}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">Marcador 90':</span>
                        <span className="font-bold text-lg text-wc26-yellow">{homeScore} - {awayScore}</span>
                      </div>
                      {showKnockoutExtras && isEtScoreFilled(etHomeScore, etAwayScore) && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-white/60">Alargue (solo suplementario):</span>
                            <span className="font-bold text-lg text-wc26-yellow">{etHomeScore} - {etAwayScore}</span>
                          </div>
                          {totalAfterEt && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-white/45">Total referencia</span>
                              <span className="font-semibold text-white/70">{totalAfterEt.home} - {totalAfterEt.away}</span>
                            </div>
                          )}
                        </>
                      )}
                      {showPenaltyPick && penaltyWinner && (
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Penales:</span>
                          <span className="font-bold text-green-300">
                            Clasifica {penaltyWinner === 'home' ? homeTeam.code : awayTeam.code}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">Resultado:</span>
                        <span className="font-bold text-green-300">
                          {getResultLabel(derivedResult, homeTeam.code, awayTeam.code)}
                        </span>
                      </div>
                      {nextMatch && (
                        <p className="border-t border-white/10 pt-3 text-xs text-white/50">
                          {match.group
                            ? `Al guardar, seguís con el próximo partido del Grupo ${match.group}.`
                            : 'Al guardar, seguís con el próximo partido de esta fase.'}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {saveHint && (
                <p className="wc26-predict-feedback wc26-predict-feedback--hint">{saveHint}</p>
              )}
              {saveError && (
                <p className="wc26-predict-feedback wc26-predict-feedback--error">{saveError}</p>
              )}
              </div>

              <footer className="wc26-predict-modal__footer shrink-0 flex gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
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
                    onClick={handleNextStep}
                    className="wc26-predict-btn wc26-predict-btn--primary flex-1"
                  >
                    {nextMatch && onContinueNext ? 'Guardar y siguiente' : 'Siguiente'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isLoading || match.isLocked || match.status !== 'scheduled'}
                    className="wc26-predict-btn wc26-predict-btn--cta flex-[1.4] disabled:opacity-50"
                  >
                    {isLoading
                      ? 'Guardando…'
                      : nextMatch
                        ? 'Guardar y siguiente'
                        : 'Guardar predicción'}
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
