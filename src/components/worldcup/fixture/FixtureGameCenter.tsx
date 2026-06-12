import { Link } from 'react-router-dom'

import { CircleDot, Star, Target, User } from 'lucide-react'

import { useScoringDisplayConfig } from '../../../hooks/useScoringDisplayConfig.ts'
import type { OverallProgress } from '../../../utils/predictionProgress'

import type { Match, Prediction } from '../../../types/worldcup'

const SCORING_RULE_TONES = [
  { id: 'exact' as const, icon: Target, label: 'Exacto', tone: 'blue' as const },
  { id: 'result' as const, icon: CircleDot, label: 'Resultado', tone: 'green' as const },
]

/** @deprecated Puntos ahora viven en la card hero del centro del juego. */
export function FixturePlayHeader({ points }: { points: number }) {
  return (
    <header className="wc26-fgc-header">
      <p className="wc26-fgc-header__brand">PRODEMUNDIAL 2026</p>
      <div className="wc26-fgc-header__actions">
        <span className="wc26-fgc-header__pts">
          <strong>{points}</strong> pts
        </span>
        <Link to="/profile" className="wc26-fgc-header__avatar" aria-label="Perfil">
          <User className="h-4 w-4" />
        </Link>
      </div>
    </header>
  )
}

type FixtureGameCenterProps = {
  overall: OverallProgress
  predictions: Prediction[]
  matches: Match[]
  points?: number
  onStartPredict?: () => void
}

export function FixtureGameCenter({
  overall: _overall,
  predictions: _predictions,
  matches: _matches,
  points = 0,
  onStartPredict,
}: FixtureGameCenterProps) {
  const { data: scoring } = useScoringDisplayConfig()

  const scoringRules = SCORING_RULE_TONES.map(rule => ({
    ...rule,
    pts: rule.id === 'exact' ? (scoring?.exactPts ?? 5) : (scoring?.resultPts ?? 3),
  }))

  return (
    <div className="wc26-fgc">
      <section className="wc26-fgc-prode-banner">
        <button type="button" className="wc26-fgc-prode-banner__main" onClick={onStartPredict}>
          <div className="wc26-fgc-prode-banner__lead">
            <span className="wc26-fgc-prode-banner__ball" aria-hidden="true">
              ⚽
            </span>
            <div className="wc26-fgc-prode-banner__copy">
              <h2 className="wc26-fgc-prode-banner__title">Arrancá tu prode</h2>
              <p className="wc26-fgc-prode-banner__text">
                Elegí un grupo, cargá tus predicciones y empezá a sumar puntos.
              </p>
            </div>
          </div>
          <div className="wc26-fgc-prode-banner__divider" aria-hidden="true" />
          <div className="wc26-fgc-prode-banner__pts" aria-label={`${points} puntos`}>
            <span className="wc26-fgc-prode-banner__pts-value">{points}</span>
            <span className="wc26-fgc-prode-banner__pts-label">PTS</span>
            <span className="wc26-fgc-prode-banner__pts-star" aria-hidden="true">
              <Star className="h-2.5 w-2.5 fill-current" />
            </span>
          </div>
        </button>

        <div className="wc26-fgc-prode-banner__scoring" aria-label="Puntos por acierto">
          {scoringRules.map((rule, index) => {
            const Icon = rule.icon
            return (
              <div
                key={rule.id}
                className={`wc26-fgc-prode-banner__score wc26-fgc-prode-banner__score--${rule.tone}`}
              >
                {index > 0 ? <span className="wc26-fgc-prode-banner__score-sep" aria-hidden="true" /> : null}
                <span className="wc26-fgc-prode-banner__score-icon" aria-hidden="true">
                  <Icon className="h-2.5 w-2.5" strokeWidth={2.2} />
                </span>
                <span className="wc26-fgc-prode-banner__score-label">{rule.label}</span>
                <span className="wc26-fgc-prode-banner__score-pts">{rule.pts} pts</span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
