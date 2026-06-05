import { motion } from 'framer-motion'

import { CalendarDays } from 'lucide-react'

import { MOTION } from '../../constants/design'

import type { Match } from '../../types/worldcup'

import { TeamCrest } from './TeamCrest'



type HomeNextMatchCardProps = {

  match: Match | null

  hasPrediction?: boolean

  onPredict: () => void

}



function fmtTime(iso: string) {

  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })

}



function fmtDate(iso: string) {

  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })

}



export function HomeNextMatchCard({ match, hasPrediction, onPredict }: HomeNextMatchCardProps) {

  if (!match?.homeTeam || !match.awayTeam) {

    return (

      <p className="wc26-next-match-hero wc26-next-match-hero--empty text-center text-sm text-wc26-text/50">

        Próximamente más partidos

      </p>

    )

  }



  const home = match.homeTeam

  const away = match.awayTeam



  return (

    <motion.section {...MOTION.enter} className="wc26-next-match-hero mx-auto w-full">

      <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-wc26-yellow">

        Próximo partido para predecir

      </p>



      <div className="flex items-center justify-center gap-4 sm:gap-6">

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">

          <TeamCrest flag={home.flag} code={home.code} name={home.name} size="lg" />

          <p className="text-sm font-extrabold leading-tight text-white sm:text-base">{home.name}</p>

        </div>



        <div className="shrink-0 text-center">

          <p className="text-xs font-black uppercase tracking-[0.25em] text-white/45">VS</p>

          <p className="mt-1 text-3xl font-black tabular-nums text-wc26-yellow">{fmtTime(match.kickoff)}</p>

          {match.group && (

            <p className="mt-1 text-[11px] font-extrabold uppercase text-white/60">Grupo {match.group}</p>

          )}

        </div>



        <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">

          <TeamCrest flag={away.flag} code={away.code} name={away.name} size="lg" />

          <p className="text-sm font-extrabold leading-tight text-white sm:text-base">{away.name}</p>

        </div>

      </div>



      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs font-semibold capitalize text-white/60">

        <CalendarDays className="h-3.5 w-3.5 text-wc26-yellow" />

        {fmtDate(match.kickoff)}

      </p>



      <motion.button

        type="button"

        onClick={onPredict}

        className="wc26-btn-predict wc26-btn-predict--pulse wc26-btn-predict--hero mx-auto mt-5"

        {...MOTION.tap}

      >

        {hasPrediction ? 'Editar mi predicción' : 'Hacer mi predicción'}

      </motion.button>

    </motion.section>

  )

}


