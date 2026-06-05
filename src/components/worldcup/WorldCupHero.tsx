import { motion, AnimatePresence } from 'framer-motion'
import { GRADIENTS, MOTION } from '../../constants/design'
import { TrophyIllustration } from './TrophyIllustration'

interface WorldCupHeroProps {
  variant?: 'mobile' | 'desktop'
  countdown?: {
    days: number
    hours: number
    minutes: number
    seconds: number
  }
  onPredict?: () => void
  onFixture?: () => void
  hasPrediction?: boolean
}

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

export function WorldCupHero({
  variant = 'mobile',
  countdown,
  onPredict,
  onFixture,
  hasPrediction,
}: WorldCupHeroProps) {
  if (variant === 'desktop') {
    return (
      <motion.div
        {...MOTION.enter}
        className="wc26-hero-desktop relative overflow-hidden rounded-[36px] p-8 shadow-wc26-glow"
        style={{ background: GRADIENTS.hero }}
      >
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <TrophyIllustration variant="hero" className="!h-28 !w-24" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-wc26-yellow">PRODEMUNDIAL</p>
              <h1 className="text-4xl font-black text-white">MUNDIAL 2026</h1>
              <p className="mt-1 text-base font-medium text-white/80">Viví el Mundial. Jugá el Prode.</p>
            </div>
          </div>
          {countdown && (
            <div className="wc26-glass flex gap-3 rounded-[28px] px-5 py-4">
              <CountdownUnits countdown={countdown} />
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onPredict} className="wc26-btn-predict px-8 py-3 text-sm">
              {hasPrediction ? 'Editar predicción' : 'Predicción rápida'}
            </button>
            <button type="button" onClick={onFixture} className="wc26-btn-fixture px-8 py-3 text-sm">
              Ver fixture
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.section {...MOTION.slideUp} className="wc26-home-hero relative px-4 pb-3 pt-1 text-center">
      <div className="relative mx-auto flex w-full max-w-sm flex-col items-center">
        <p className="w-full text-center text-[10px] font-black uppercase tracking-[0.32em] text-[#F8B91E] drop-shadow-sm">
          PRODEMUNDIAL 2026
        </p>
        <h1
          className="mt-2 w-full text-center font-black uppercase leading-[0.95] tracking-tight text-white drop-shadow-lg"
          style={{ fontSize: 'clamp(1.5rem, 6.5vw, 2rem)' }}
        >
          VIVÍ EL MUNDIAL 2026
        </h1>
        <p className="mt-1.5 w-full text-center text-sm font-semibold text-white/90 drop-shadow-sm">
          Viví el Mundial. Jugá el Prode.
        </p>

        <div className="relative mx-auto my-2 flex w-full max-w-[200px] justify-center">
          <TrophyIllustration variant="hero" />
        </div>

        {countdown && (
          <motion.div {...MOTION.fadeIn} className="wc26-countdown-panel mx-auto w-full max-w-[22rem]">
            <p className="wc26-countdown-title mb-3 text-center">
              Falta para el próximo partido
            </p>
            <CountdownUnits countdown={countdown} compact />
          </motion.div>
        )}
      </div>
    </motion.section>
  )
}
