import { useEffect, useMemo, useState } from 'react'

import { Link } from 'react-router-dom'

import { motion, useReducedMotion } from 'framer-motion'

import { Calendar, Pencil, Trophy, User } from 'lucide-react'

import { MOTION } from '../../../constants/design'

import type { OverallProgress } from '../../../utils/predictionProgress'

import { getPlaySteps } from '../../../utils/predictionProgress'

import type { Match, Prediction } from '../../../types/worldcup'



const MINI_TIPS = ['Exacto = 5 pts', 'Resultado = 3 pts', 'Se bloquea al iniciar'] as const



const STEP_ICONS = {

  group: Calendar,

  predict: Pencil,

  points: Trophy,

} as const



function PlayStepper({

  overall,

  predictions,

  reduceMotion,

}: {

  overall: OverallProgress

  predictions: Prediction[]

  reduceMotion: boolean | null

}) {

  const steps = useMemo(() => getPlaySteps(overall, predictions), [overall, predictions])



  return (

    <motion.section {...MOTION.enter} className="wc26-fgc-stepper" aria-label="Cómo jugar">

      <ol className="wc26-fgc-stepper__list">

        {steps.map((step, index) => {

          const Icon = STEP_ICONS[step.id as keyof typeof STEP_ICONS] ?? Calendar

          return (

            <motion.li

              key={step.id}

              initial={reduceMotion ? false : { opacity: 0, y: 8 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ delay: reduceMotion ? 0 : index * 0.06 }}

              className={`wc26-fgc-stepper__step wc26-fgc-stepper__step--${step.state}`}

            >

              <span className="wc26-fgc-stepper__num">{index + 1}</span>

              <span className="wc26-fgc-stepper__icon" aria-hidden="true">

                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />

              </span>

              <span className="wc26-fgc-stepper__label">{step.label}</span>

            </motion.li>

          )

        })}

      </ol>

    </motion.section>

  )

}



export function FixturePlayHeader({ points }: { points: number }) {

  return (

    <header className="wc26-fgc-header">

      <p className="wc26-fgc-header__brand">PRODE 2026</p>

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

}



export function FixtureGameCenter({ overall, predictions }: FixtureGameCenterProps) {

  const reduceMotion = useReducedMotion()

  const [tipIndex, setTipIndex] = useState(0)



  useEffect(() => {

    if (reduceMotion) return

    const id = window.setInterval(() => setTipIndex(i => (i + 1) % MINI_TIPS.length), 4000)

    return () => window.clearInterval(id)

  }, [reduceMotion])



  return (

    <div className="wc26-fgc space-y-3">

      <motion.section {...MOTION.enter} className="wc26-fgc-intro">

        <h2 className="wc26-fgc-intro__title">Centro del juego</h2>

        <p className="wc26-fgc-intro__text">Elegí un grupo, predecí los partidos y sumá puntos.</p>

      </motion.section>



      <PlayStepper overall={overall} predictions={predictions} reduceMotion={reduceMotion} />



      <motion.p

        key={tipIndex}

        initial={reduceMotion ? false : { opacity: 0 }}

        animate={{ opacity: 1 }}

        className="wc26-fgc-mini-tip"

        aria-live="polite"

      >

        {MINI_TIPS[tipIndex]}

      </motion.p>

    </div>

  )

}


