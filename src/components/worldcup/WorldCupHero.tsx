import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HOME_PREMIUM, MOTION } from '../../constants/design'
import { useMatchCountdown } from '../../hooks/useMatchCountdown'
import type { Match } from '../../types/worldcup'
import {
  formatNextMatchKickoff,
  shortTeamDisplayName,
  type NextMatchPhase,
} from '../../utils/predictionProgress'
import { TeamCrest } from './TeamCrest'
import { TrophyIllustration } from './TrophyIllustration'

interface WorldCupHeroProps {
  variant?: 'mobile' | 'desktop'
  /** Countdown aislado (1 s) sin re-renderizar el Home. */
  useIsolatedCountdown?: boolean
  countdownMatch?: Match | null
  phase?: NextMatchPhase
  countdown?: {
    days: number
    hours: number
    minutes: number
    seconds: number
  }
  countdownHint?: string
  nextMatch?: Match | null
  onPredict?: () => void
  onFixture?: () => void
  hasPrediction?: boolean
}

function resolveLiveCountdownHint(
  phase: NextMatchPhase | undefined,
  countdown: ReturnType<typeof useMatchCountdown>,
  externalHint?: string,
) {
  if (countdown) return undefined
  if (externalHint) return externalHint
  if (phase === 'starting_soon') return '¡Arranca pronto!'
  if (phase === 'live') return 'Partido en curso'
  return undefined
}

const HeroCountdownPanel = memo(function HeroCountdownPanel({
  countdownMatch,
  phase,
  countdownHint,
  nextMatch,
  title,
  compact,
}: {
  countdownMatch: Match | null
  phase?: NextMatchPhase
  countdownHint?: string
  nextMatch?: Match | null
  title: string
  compact?: boolean
}) {
  const countdown = useMatchCountdown(countdownMatch)
  const hint = resolveLiveCountdownHint(phase, countdown, countdownHint)

  return (
    <CountdownBlock
      countdown={countdown}
      countdownHint={hint}
      nextMatch={nextMatch ?? countdownMatch}
      title={title}
      compact={compact}
    />
  )
})

function CountdownUnits({ countdown, compact }: { countdown: NonNullable<WorldCupHeroProps['countdown']>; compact?: boolean }) {
  const units = [
    { v: countdown.days, l: compact ? 'DÍAS' : 'D' },
    { v: countdown.hours, l: compact ? 'HRS' : 'H' },
    { v: countdown.minutes, l: compact ? 'MIN' : 'M' },
    { v: countdown.seconds, l: compact ? 'SEG' : 'S' },
  ]

  return (
    <div className={`wc26-countdown-grid ${compact ? 'wc26-countdown-grid--compact' : ''}`}>
      {units.map(({ v, l }) => (
        <motion.div key={l} layout className="wc26-countdown-card">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={v}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="wc26-countdown-number"
            >
              {String(v).padStart(2, '0')}
            </motion.span>
          </AnimatePresence>
          <span className="wc26-countdown-label">{l}</span>
        </motion.div>
      ))}
    </div>
  )
}

function CountdownMatchTeams({ match, compact }: { match: Match; compact?: boolean }) {
  const home = match.homeTeam
  const away = match.awayTeam
  if (!home || !away) return null

  const crestSize = compact ? 'sm' : 'md'

  return (
    <div className={`wc26-countdown-teams${compact ? ' wc26-countdown-teams--compact' : ''}`}>
      <div className="wc26-countdown-teams__side">
        <TeamCrest flag={home.flag} code={home.code} name={home.name} size={crestSize} />
        <span className="wc26-countdown-teams__name">{shortTeamDisplayName(home.name)}</span>
      </div>
      <span className="wc26-countdown-teams__vs">vs</span>
      <div className="wc26-countdown-teams__side">
        <TeamCrest flag={away.flag} code={away.code} name={away.name} size={crestSize} />
        <span className="wc26-countdown-teams__name">{shortTeamDisplayName(away.name)}</span>
      </div>
    </div>
  )
}

function CountdownBlock({
  countdown,
  countdownHint,
  nextMatch,
  title,
  compact,
}: {
  countdown?: WorldCupHeroProps['countdown']
  countdownHint?: string
  nextMatch?: Match | null
  title: string
  compact?: boolean
}) {
  if (!countdown && !countdownHint && !nextMatch) return null

  const kickoffLabel = nextMatch ? formatNextMatchKickoff(nextMatch) : null

  return (
    <div className={`wc26-countdown-panel${compact ? '' : ' wc26-countdown-panel--desktop'}`}>
      <p className="wc26-countdown-title mb-2 text-center">{title}</p>
      {nextMatch?.homeTeam && nextMatch?.awayTeam ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={nextMatch.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="mb-2"
          >
            <CountdownMatchTeams match={nextMatch} compact={compact} />
          </motion.div>
        </AnimatePresence>
      ) : null}
      {kickoffLabel && countdown ? (
        <p className="wc26-countdown-kickoff mb-3 text-center">{kickoffLabel}</p>
      ) : null}
      {countdown ? (
        <CountdownUnits countdown={countdown} compact={compact} />
      ) : countdownHint ? (
        <p className="wc26-countdown-hint text-center">{countdownHint}</p>
      ) : null}
      {kickoffLabel && !countdown && countdownHint ? (
        <p className="wc26-countdown-kickoff mt-2 text-center">{kickoffLabel}</p>
      ) : null}
    </div>
  )
}

export const WorldCupHero = memo(function WorldCupHero({
  variant = 'mobile',
  useIsolatedCountdown = false,
  countdownMatch = null,
  phase,
  countdown,
  countdownHint,
  nextMatch,
  onPredict,
  onFixture,
  hasPrediction,
}: WorldCupHeroProps) {
  const showCountdownSection =
    useIsolatedCountdown || countdown || countdownHint || nextMatch

  if (variant === 'desktop') {
    return (
      <motion.div
        {...MOTION.enter}
        className="wc26-hero-desktop relative overflow-hidden rounded-[36px] p-8"
        style={{ background: HOME_PREMIUM.heroGradient }}
      >
        <div className="wc26-hero-desktop__glow wc26-hero-desktop__glow--left" aria-hidden="true" />
        <div className="wc26-hero-desktop__glow wc26-hero-desktop__glow--right" aria-hidden="true" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <TrophyIllustration variant="hero" className="!h-28 !w-24" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-[#F8B91E]">PRODEMUNDIAL</p>
              <h1 className="text-4xl font-black text-[#F4F7FA]">MUNDIAL 2026</h1>
              <p className="mt-1 text-base font-medium text-[#F4F7FA]/80">Viví el Mundial. Jugá el Prode.</p>
            </div>
          </div>
          {useIsolatedCountdown ? (
            <HeroCountdownPanel
              countdownMatch={countdownMatch}
              phase={phase}
              countdownHint={countdownHint}
              nextMatch={nextMatch}
              title="Próximo partido"
            />
          ) : showCountdownSection ? (
            <CountdownBlock
              countdown={countdown}
              countdownHint={countdownHint}
              nextMatch={nextMatch}
              title="Próximo partido"
            />
          ) : null}
          <div className="flex gap-3">
            <motion.button
              type="button"
              onClick={onPredict}
              className="wc26-home-hero__cta"
              {...MOTION.tap}
            >
              {hasPrediction ? 'Editar predicción' : 'Predecir ahora'}
            </motion.button>
            <motion.button
              type="button"
              onClick={onFixture}
              className="wc26-btn-fixture px-8 py-3 text-sm"
              {...MOTION.tap}
            >
              Ver fixture
            </motion.button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.section {...MOTION.slideUp} className="wc26-home-hero relative px-4 pb-3 pt-1 text-center">
      <div className="wc26-home-hero__aurora" aria-hidden="true" />
      <div className="relative mx-auto flex w-full max-w-sm flex-col items-center">
        <p className="w-full text-center text-[10px] font-black uppercase tracking-[0.32em] text-[#F8B91E] drop-shadow-sm">
          PRODEMUNDIAL 2026
        </p>
        <h1
          className="mt-2 w-full text-center font-black uppercase leading-[0.95] tracking-tight text-[#F4F7FA] drop-shadow-lg"
          style={{ fontSize: 'clamp(1.5rem, 6.5vw, 2rem)' }}
        >
          VIVÍ EL MUNDIAL 2026
        </h1>
        <p className="mt-1.5 w-full text-center text-sm font-semibold text-[#F4F7FA]/90 drop-shadow-sm">
          Viví el Mundial. Jugá el Prode.
        </p>

        <div className="relative mx-auto my-2 flex w-full max-w-[200px] justify-center">
          <TrophyIllustration variant="hero" />
        </div>

        {showCountdownSection && (
          <motion.div {...MOTION.fadeIn} className="mx-auto w-full max-w-[22rem]">
            {useIsolatedCountdown ? (
              <HeroCountdownPanel
                countdownMatch={countdownMatch}
                phase={phase}
                countdownHint={countdownHint}
                nextMatch={nextMatch}
                title="Próximo partido"
                compact
              />
            ) : (
              <CountdownBlock
                countdown={countdown}
                countdownHint={countdownHint}
                nextMatch={nextMatch}
                title="Próximo partido"
                compact
              />
            )}
          </motion.div>
        )}

        {onPredict && (
          <motion.button
            type="button"
            onClick={onPredict}
            className="wc26-home-hero__cta wc26-home-hero__cta--mobile mx-auto mt-4 w-full max-w-[22rem]"
            {...MOTION.tap}
          >
            {hasPrediction ? 'Editar predicción' : 'Predecir ahora'}
          </motion.button>
        )}
      </div>
    </motion.section>
  )
})
