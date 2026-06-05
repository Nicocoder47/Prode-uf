import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { StatBar, StatDonut } from './StatVisualizations'
import { fmtVerifiedField } from '../../utils/formatDisplay'

interface Wc26Stats {
  appearances: number
  goals: number
  assists: number
}

interface PlayerStatsSectionsProps {
  wc26: Wc26Stats
  historical: {
    appearances: number
    goals: number
    assists: number
    rating: number | null
    club: string | null
  }
}

function DonutBlock({ stats }: { stats: Wc26Stats }) {
  const max = Math.max(stats.goals, stats.assists, stats.appearances, 1)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatDonut label="Goles" value={stats.goals} max={max} />
        <StatDonut label="Asist." value={stats.assists} max={max} />
        <StatDonut label="PJ" value={stats.appearances} max={max} />
      </div>
      <StatBar label="Goles" value={stats.goals} max={max} color="green" />
      <StatBar label="Asistencias" value={stats.assists} max={max} color="blue" />
      <StatBar label="Partidos" value={stats.appearances} max={max} color="gold" />
    </div>
  )
}

function EmptyStatMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm font-medium text-white/50">
      {children}
    </p>
  )
}

export function PlayerStatsSections({ wc26, historical }: PlayerStatsSectionsProps) {
  const hasWc26 = wc26.appearances > 0 || wc26.goals > 0 || wc26.assists > 0
  const hasHistorical =
    historical.appearances > 0 ||
    historical.goals > 0 ||
    historical.assists > 0 ||
    (historical.rating != null && historical.rating > 0) ||
    !!historical.club

  return (
    <motion.div {...MOTION.enter} className="space-y-5">
      <section className="wc26-card p-5">
        <p className="wc26-section-title">Estadísticas Mundial 2026</p>
        {hasWc26 ? (
          <DonutBlock stats={wc26} />
        ) : (
          <EmptyStatMessage>
            Las estadísticas del Mundial 2026 aparecerán cuando el jugador dispute partidos.
          </EmptyStatMessage>
        )}
      </section>

      <section className="wc26-card p-5">
        <p className="wc26-section-title">Estadísticas históricas / carrera</p>
        {hasHistorical ? (
          <div className="mt-2 space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { l: 'Partidos', v: historical.appearances > 0 ? historical.appearances : null },
                { l: 'Goles', v: historical.goals > 0 ? historical.goals : null },
                { l: 'Asistencias', v: historical.assists > 0 ? historical.assists : null },
                {
                  l: 'Rating',
                  v: historical.rating != null && historical.rating > 0 ? historical.rating.toFixed(1) : null,
                },
              ].map(r => (
                <div key={r.l} className="wc26-data-tile text-center">
                  <p className="wc26-data-tile__label">{r.l}</p>
                  <p className={`wc26-data-tile__value${!r.v ? ' is-empty' : ''}`}>{fmtVerifiedField(r.v)}</p>
                </div>
              ))}
            </div>
            <div className="wc26-data-tile">
              <p className="wc26-data-tile__label">Club actual</p>
              <p className={`wc26-data-tile__value${!historical.club ? ' is-empty' : ''}`}>
                {fmtVerifiedField(historical.club)}
              </p>
            </div>
            {(historical.appearances > 0 || historical.goals > 0 || historical.assists > 0) && (
              <DonutBlock stats={historical} />
            )}
          </div>
        ) : (
          <EmptyStatMessage>Estadísticas históricas pendientes de verificación.</EmptyStatMessage>
        )}
      </section>
    </motion.div>
  )
}
