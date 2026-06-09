import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Trophy, Target, Sparkles } from 'lucide-react'
import { MOTION } from '../../../constants/design'
import type { LeaderboardEntry } from '../../../types/worldcup'
import type { OverallProgress, GroupProgress } from '../../../utils/predictionProgress'
import {
  getFixtureMotivation,
  getFixtureTimelineSteps,
  getRecommendedGroup,
} from '../../../utils/predictionProgress'
import type { Match, Prediction } from '../../../types/worldcup'

const TIPS = [
  'Marcador exacto = 5 puntos',
  'Resultado correcto = 3 puntos',
  'Los partidos se bloquean al comenzar',
  'Completá un grupo antes de que cierre el fixture',
] as const

type FixtureGameCenterProps = {
  overall: OverallProgress
  groupProgress: GroupProgress[]
  predictions: Prediction[]
  matches: Match[]
  me: LeaderboardEntry | undefined
  leader: LeaderboardEntry | undefined
  onCompletePredictions: () => void
  recommendedGroupLabel?: string | null
  showCompetition?: boolean
}

export function FixtureGameCenter({
  overall,
  groupProgress,
  predictions,
  matches,
  me,
  leader,
  onCompletePredictions,
  recommendedGroupLabel,
  showCompetition = true,
}: FixtureGameCenterProps) {
  const reduceMotion = useReducedMotion()
  const motivation = useMemo(() => getFixtureMotivation(overall), [overall])
  const timeline = useMemo(
    () => getFixtureTimelineSteps(overall, predictions, matches),
    [overall, predictions, matches]
  )
  const recommended = useMemo(() => getRecommendedGroup(groupProgress), [groupProgress])
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    if (reduceMotion) return
    const id = window.setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 4500)
    return () => window.clearInterval(id)
  }, [reduceMotion])

  const gapToLeader =
    me && leader && leader.userId !== me.userId ? Math.max(0, leader.points - me.points) : null

  return (
    <div className="wc26-fixture-premium space-y-4">
      <motion.section {...MOTION.enter} className="wc26-fixture-premium-hero">
        <div className="wc26-fixture-premium-hero__glow" aria-hidden="true" />
        <p className="wc26-fixture-premium-hero__kicker">
          <Trophy className="inline h-4 w-4 text-[#F8B91E]" aria-hidden="true" /> Centro del Juego
        </p>
        <h1 className="wc26-fixture-premium-hero__title">Fixture Mundial 2026</h1>
        <p className="wc26-fixture-premium-hero__subtitle">
          Elegí grupos, completá predicciones y competí por el primer puesto.
        </p>

        {me || overall.total > 0 ? (
          <div className="wc26-fixture-premium-hero__stats">
            <div className="wc26-fixture-premium-hero__stat">
              <span className="wc26-fixture-premium-hero__stat-label">Ranking</span>
              <span className="wc26-fixture-premium-hero__stat-value">
                {me?.rank != null ? `#${me.rank}` : '—'}
              </span>
            </div>
            <div className="wc26-fixture-premium-hero__stat wc26-fixture-premium-hero__stat--gold">
              <span className="wc26-fixture-premium-hero__stat-label">Puntos</span>
              <span className="wc26-fixture-premium-hero__stat-value">{me?.points ?? 0}</span>
            </div>
            <div className="wc26-fixture-premium-hero__stat">
              <span className="wc26-fixture-premium-hero__stat-label">Progreso</span>
              <span className="wc26-fixture-premium-hero__stat-value">
                {overall.predicted}/{overall.total}
              </span>
            </div>
          </div>
        ) : null}

        {recommendedGroupLabel ? (
          <p className="wc26-fixture-premium-hero__hint">
            <Sparkles className="inline h-3.5 w-3.5 text-[#F8B91E]" /> Siguiente: Grupo {recommendedGroupLabel}
          </p>
        ) : null}
      </motion.section>

      <motion.section {...MOTION.enter} className="wc26-fixture-premium-progress">
        <div className="wc26-fixture-premium-progress__head">
          <div>
            <p className="wc26-fixture-premium-section-kicker">Tu camino</p>
            <h2 className="wc26-fixture-premium-section-title">Progreso del Mundial</h2>
          </div>
          <span className="wc26-fixture-premium-progress__pct">{overall.percent}%</span>
        </div>

        <p className="wc26-fixture-premium-progress__count">
          {overall.predicted} / {overall.total} partidos predichos
        </p>

        <div className="wc26-fixture-premium-progress__track">
          <motion.div
            className="wc26-fixture-premium-progress__fill"
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${overall.percent}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <p className="wc26-fixture-premium-progress__motivation">{motivation}</p>

        {overall.pending > 0 ? (
          <p className="wc26-fixture-premium-progress__pending">
            Te faltan {overall.pending} partido{overall.pending === 1 ? '' : 's'} para completar el
            Mundial
          </p>
        ) : null}

        <p className="wc26-fixture-premium-progress__points">
          Proyección máxima posible:{' '}
          <strong>{overall.remainingPoints} pts</strong> en partidos abiertos
        </p>
      </motion.section>

      <motion.section {...MOTION.enter} className="wc26-fixture-premium-timeline">
        <p className="wc26-fixture-premium-section-kicker">Paso a paso</p>
        <h2 className="wc26-fixture-premium-section-title">¿Dónde estás?</h2>
        <ol className="wc26-fixture-premium-timeline__list">
          {timeline.map((step, index) => (
            <motion.li
              key={step.id}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.06 }}
              className={`wc26-fixture-premium-timeline__step wc26-fixture-premium-timeline__step--${step.state}`}
            >
              <span className="wc26-fixture-premium-timeline__icon" aria-hidden="true">
                {step.state === 'done' ? '✔' : step.state === 'active' ? '🟡' : '⚪'}
              </span>
              <span>{step.label}</span>
            </motion.li>
          ))}
        </ol>
      </motion.section>

      {showCompetition && me ? (
        <motion.section {...MOTION.enter} className="wc26-fixture-premium-competition">
          <p className="wc26-fixture-premium-section-kicker">Competencia</p>
          <h2 className="wc26-fixture-premium-section-title">Tu posición</h2>
          <div className="wc26-fixture-premium-competition__grid">
            <div>
              <p className="wc26-fixture-premium-competition__rank">#{me.rank ?? '—'}</p>
              <p className="wc26-fixture-premium-competition__label">Tu puesto</p>
            </div>
            <div>
              <p className="wc26-fixture-premium-competition__value">{me.points} pts</p>
              <p className="wc26-fixture-premium-competition__label">Tus puntos</p>
            </div>
            {leader ? (
              <div>
                <p className="wc26-fixture-premium-competition__value">{leader.points} pts</p>
                <p className="wc26-fixture-premium-competition__label">Líder</p>
              </div>
            ) : null}
          </div>
          {gapToLeader != null && gapToLeader > 0 ? (
            <p className="wc26-fixture-premium-competition__gap">
              Te faltan <strong>{gapToLeader} pts</strong> para alcanzar al líder
            </p>
          ) : gapToLeader === 0 ? (
            <p className="wc26-fixture-premium-competition__gap">¡Estás liderando el ranking!</p>
          ) : null}
          <Link to="/leaderboard" className="wc26-fixture-premium-competition__link">
            Ver ranking completo
          </Link>
        </motion.section>
      ) : null}

      <motion.section {...MOTION.enter} className="wc26-fixture-premium-tips">
        <div className="wc26-fixture-premium-tips__head">
          <Target className="h-4 w-4 text-[#F8B91E]" />
          <p className="wc26-fixture-premium-section-kicker !mb-0">Tips PRODE</p>
        </div>
        <motion.p
          key={tipIndex}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="wc26-fixture-premium-tips__text"
        >
          {TIPS[tipIndex]}
        </motion.p>
      </motion.section>

      {recommended && overall.pending > 0 ? (
        <p className="wc26-fixture-premium-recommend">
          Completá primero el <strong>Grupo {recommended.groupId}</strong> —{' '}
          {recommended.pending} pendiente{recommended.pending === 1 ? '' : 's'}
        </p>
      ) : null}

      {overall.pending > 0 ? (
        <>
          <div className="wc26-fixture-sticky-spacer" aria-hidden="true" />
          <motion.button
            type="button"
            className="wc26-fixture-sticky-cta"
            onClick={onCompletePredictions}
            {...MOTION.tap}
          >
            Completar predicciones
          </motion.button>
        </>
      ) : null}
    </div>
  )
}
