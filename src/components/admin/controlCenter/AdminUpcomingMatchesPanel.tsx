import { useEffect, useState } from 'react'
import type { UpcomingMatchRow } from '../../../types/admin'
import type { Match } from '../../../types/worldcup'
import { formatKickoffCountdown } from '../../../utils/adminControlCenter'
import { AdminControlGlass } from './AdminControlGlass'

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function matchLabel(match: UpcomingMatchRow, lookup: Map<string, Match>) {
  const full = lookup.get(match.id)
  if (full?.homeTeam?.name && full?.awayTeam?.name) {
    return `${full.homeTeam.name} vs ${full.awayTeam.name}`
  }
  return match.group_label ?? match.phase ?? 'Partido'
}

function Countdown({ kickOff }: { kickOff: string }) {
  const [label, setLabel] = useState(() => formatKickoffCountdown(kickOff))

  useEffect(() => {
    const tick = () => setLabel(formatKickoffCountdown(kickOff))
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [kickOff])

  return <span className="admin-control-match__countdown">{label}</span>
}

type AdminUpcomingMatchesPanelProps = {
  upcoming: UpcomingMatchRow[]
  matchesById: Map<string, Match>
  predictionCounts: Record<string, number>
  activeUsers: number
}

export function AdminUpcomingMatchesPanel({
  upcoming,
  matchesById,
  predictionCounts,
  activeUsers,
}: AdminUpcomingMatchesPanelProps) {
  const rows = upcoming.slice(0, 5)

  return (
    <AdminControlGlass
      kicker="Fixture"
      title="Próximos partidos"
      description="Countdown y predicciones cargadas"
    >
      {rows.length === 0 ? (
        <p className="admin-control-empty">No hay partidos programados próximos.</p>
      ) : (
        <ul className="admin-control-matches">
          {rows.map(match => {
            const predictions = predictionCounts[match.id] ?? 0
            const pct = activeUsers > 0 ? Math.round((predictions / activeUsers) * 100) : 0

            return (
              <li key={match.id} className="admin-control-match">
                <div className="admin-control-match__head">
                  <p className="admin-control-match__teams">{matchLabel(match, matchesById)}</p>
                  <Countdown kickOff={match.kick_off} />
                </div>
                <div className="admin-control-match__meta">
                  <span>{match.group_label ?? match.phase ?? 'Mundial'}</span>
                  <span>{formatDate(match.kick_off)}</span>
                </div>
                <div className="admin-control-match__predictions">
                  <strong>{predictions}</strong> predicciones
                  {activeUsers > 0 ? <span> · {pct}% de activos</span> : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </AdminControlGlass>
  )
}
