// Match Prediction Modal - Complete prediction form

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, Clock, X, Check, Trophy, ArrowRight, Minus, Plus } from 'lucide-react'
import { TeamCrest } from './TeamCrest'
import type { Match, Prediction } from '../../types/worldcup'
import type { PredictionResult } from '../../types/api'
import { useAppToast } from '../ui/ToastProvider'
import { getNextGroupMatch, MAX_POINTS_PER_MATCH } from '../../utils/predictionProgress'
import {
  getResultLabel,
  getWinnerFromScore,
} from '../../utils/predictionValidation'

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
  }) => Promise<void>
  existingPrediction?: Partial<Prediction>
  allMatches?: Match[]
  onContinueNext?: (next: Match) => void
}

function ScoreDial({
  value,
  onChange,
  code,
}: {
  value: number
  onChange: (next: number) => void
  code: string
}) {
  const dec = () => onChange(Math.max(0, value - 1))
  const inc = () => onChange(Math.min(9, value + 1))

  return (
    <div className="wc26-predict-score-side">
      <span className="wc26-predict-score-side__badge">{code}</span>
      <div className="wc26-predict-score-dial wc26-predict-score-dial--premium">
        <button type="button" onClick={dec} className="wc26-predict-score-dial__btn" aria-label={`Menos goles ${code}`}>
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
        <button type="button" onClick={inc} className="wc26-predict-score-dial__btn" aria-label={`Más goles ${code}`}>
          <Plus className="h-4 w-4" />
        </button>
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
  const [isLoading, setIsLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()

  const { showToast } = useAppToast()

  const nextGroupMatch = useMemo(
    () => (allMatches.length > 0 ? getNextGroupMatch(allMatches, match) : null),
    [allMatches, match],
  )

  const derivedResult = useMemo(
    () => getWinnerFromScore(homeScore, awayScore),
    [homeScore, awayScore]
  )

  useEffect(() => {
    if (!isOpen) return
    setSaved(false)
    setSaveError(null)
    setStep(existingPrediction ? 'review' : 'score')
    setHomeScore(existingPrediction?.exactScore?.home ?? existingPrediction?.predictedHomeScore ?? 1)
    setAwayScore(existingPrediction?.exactScore?.away ?? existingPrediction?.predictedAwayScore ?? 0)
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
    setIsLoading(true)
    try {
      await onSave({
        matchId: match.id,
        result: derivedResult,
        exactScore: { home: homeScore, away: awayScore },
      })

      if (nextGroupMatch && onContinueNext) {
        showToast('✔ Guardada · siguiente del grupo')
        onContinueNext(nextGroupMatch)
        return
      }

      showToast('✔ Predicción guardada')
      onClose()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar la predicción.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNextStep = () => {
    if (step === 'score' && nextGroupMatch && onContinueNext) {
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

          <div className="wc26-predict-modal-shell fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="wc26-predict-modal wc26-predict-modal--premium pointer-events-auto flex max-h-[min(92vh,720px)] w-full max-w-[min(95vw,32rem)] flex-col overflow-hidden box-border"
              onClick={e => e.stopPropagation()}
            >
              <header className="wc26-predict-modal__header shrink-0 px-5 pb-4 pt-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center justify-center gap-3 sm:gap-5">
                    <div className="wc26-predict-match-team">
                      <div className="wc26-predict-match-team__crest">
                        <TeamCrest flag={homeTeam.flag} code={homeTeam.code} name={homeTeam.name} size="lg" premium />
                      </div>
                      <p className="wc26-predict-match-team__name">{homeTeam.name}</p>
                      <span className="wc26-predict-match-team__code">{homeTeam.code}</span>
                    </div>
                    <div className="wc26-predict-vs">
                      <span>VS</span>
                    </div>
                    <div className="wc26-predict-match-team">
                      <div className="wc26-predict-match-team__crest">
                        <TeamCrest flag={awayTeam.flag} code={awayTeam.code} name={awayTeam.name} size="lg" premium />
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
                      <h3 className="wc26-predict-step-title">Marcador exacto</h3>
                      <p className="wc26-predict-step-sub">El ganador se infiere del marcador</p>
                    </div>

                    <div className="wc26-predict-scoreboard wc26-predict-scoreboard--premium">
                      <span className="wc26-predict-scoreboard__shine" aria-hidden="true" />
                      <ScoreDial value={homeScore} onChange={setHomeScore} code={homeTeam.code} />
                      <div className="wc26-predict-scoreboard__center" aria-hidden="true">
                        <span className="wc26-predict-scoreboard__colon">:</span>
                      </div>
                      <ScoreDial value={awayScore} onChange={setAwayScore} code={awayTeam.code} />
                    </div>

                    <div className="wc26-predict-score-preview wc26-predict-score-preview--premium">
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

                {step === 'review' && (
                  <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                    <h3 className="wc26-predict-step-title">Confirmá tu predicción</h3>
                    <div className="wc26-predict-review wc26-predict-review--premium space-y-3 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/60">Partido</span>
                        <span className="text-right text-sm font-bold text-white">
                          {homeTeam.code} vs {awayTeam.code}
                        </span>
                      </div>
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
                      {nextGroupMatch && (
                        <p className="border-t border-white/10 pt-3 text-xs text-white/50">
                          Al guardar, seguís con el próximo partido del Grupo {match.group}.
                        </p>
                      )}
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
                    onClick={handleNextStep}
                    className="wc26-predict-btn wc26-predict-btn--primary flex-1"
                  >
                    Siguiente
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
                      : nextGroupMatch
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
