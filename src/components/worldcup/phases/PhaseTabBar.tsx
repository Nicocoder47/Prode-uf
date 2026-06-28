import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import type { MatchStage } from '../../../types/worldcup'
import { TOURNAMENT_PHASES } from '../../../constants/phases'
import type { PhaseProgress } from '../../../constants/phases'

const PHASE_ICON: Record<string, string> = {
  group:         '⚽',
  round32:       '🔵',
  round16:       '⚡',
  quarterfinals: '🔥',
  semifinals:    '⭐',
  thirdplace:    '🥉',
  final:         '🏆',
}

interface PhaseTabBarProps {
  activePhase: MatchStage
  onChangePhase: (phase: MatchStage) => void
  progress: PhaseProgress[]
}

export function PhaseTabBar({ activePhase, onChangePhase, progress }: PhaseTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current
      const el = activeRef.current
      const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2
      container.scrollTo({ left, behavior: 'smooth' })
    }
  }, [activePhase])

  return (
    <div className="wc26-phase-tabbar-wrapper">
      <div ref={scrollRef} className="wc26-phase-tabbar">
        {TOURNAMENT_PHASES.map(phase => {
          const phaseProgress = progress.find(p => p.stage === phase.id)
          const isActive = activePhase === phase.id
          const isLocked = !(phaseProgress?.unlocked ?? false)
          const icon = PHASE_ICON[phase.id] ?? '🎯'
          const isDone = !isLocked && !!phaseProgress &&
            phaseProgress.total > 0 &&
            phaseProgress.predicted >= phaseProgress.total

          return (
            <button
              key={phase.id}
              ref={isActive ? activeRef : undefined}
              type="button"
              onClick={() => !isLocked && onChangePhase(phase.id)}
              disabled={isLocked}
              className={[
                'wc26-phase-tab',
                isActive ? 'wc26-phase-tab--active' : '',
                isLocked ? 'wc26-phase-tab--locked' : '',
                isDone ? 'wc26-phase-tab--done' : '',
              ].filter(Boolean).join(' ')}
            >
              {isActive && (
                <motion.div
                  layoutId="phase-tab-indicator"
                  className="wc26-phase-tab__indicator"
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                />
              )}

              <span className="wc26-phase-tab__icon" aria-hidden="true">
                {isLocked ? '🔒' : icon}
              </span>

              <span className="wc26-phase-tab__label">
                {phase.shortLabel}
              </span>

              {!isLocked && phaseProgress && phaseProgress.total > 0 ? (
                <span className="wc26-phase-tab__count">
                  {isDone ? '✓' : `${phaseProgress.predicted}/${phaseProgress.total}`}
                </span>
              ) : isLocked ? (
                <span className="wc26-phase-tab__soon">Pronto</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
