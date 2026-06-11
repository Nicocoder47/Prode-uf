import { Link } from 'react-router-dom'
import {
  AdminAttentionPanel,
  AdminLiveActivityTimeline,
  AdminUpcomingMatchesPanel,
} from '../controlCenter'
import { AdminMatchDayCard } from '../AdminMatchDayCard'
import { AdminStatusLight } from '../AdminStatusLight'
import { OperationsAlertCenter } from '../enterprise'
import type { AdminDashboard } from '../../../types/admin'
import type { OperationalAlert } from '../../../types/adminOperations'
import type { Match } from '../../../types/worldcup'
import type { AdminScoringCenter } from '../../../types/admin'
import type { AttentionItem, LiveFeedItem } from '../../../utils/adminControlCenter'

type Props = {
  data: AdminDashboard
  alerts: OperationalAlert[]
  overall: 'green' | 'yellow' | 'red'
  attentionItems: AttentionItem[]
  liveFeed: LiveFeedItem[]
  upcoming: NonNullable<AdminDashboard['upcoming_matches']>
  matchesById: Map<string, Match>
  predictionCounts: Record<string, number>
  scoring?: AdminScoringCenter | null
  matches?: Match[]
  capacitySlots?: string
}

export function AdminDashboardMobile({
  data,
  alerts,
  overall,
  attentionItems,
  liveFeed,
  upcoming,
  matchesById,
  predictionCounts,
  scoring,
  matches,
  capacitySlots,
}: Props) {
  const kpis = [
    {
      label: 'Cupos disponibles',
      value: capacitySlots ?? '—',
      state: overall,
      to: '/admin/beta-capacity',
    },
    {
      label: 'Usuarios activos',
      value: String(data.active_users),
      state: 'green' as const,
      to: '/admin/users',
    },
    {
      label: 'Integridad scoring',
      value: (scoring?.orphan_scored?.count ?? 0) > 0 ? 'Revisar' : 'OK',
      state: (scoring?.orphan_scored?.count ?? 0) > 0 ? ('yellow' as const) : ('green' as const),
      to: '/admin/scoring',
    },
    {
      label: 'Estado sistema',
      value: overall === 'green' ? 'OK' : overall === 'yellow' ? 'Atención' : 'Crítico',
      state: overall,
      to: '/admin/health',
    },
  ]

  const quickLinks = [
    { to: '/admin/users', label: 'Usuarios' },
    { to: '/admin/scoring', label: 'Scoring' },
    { to: '/admin/support', label: 'Soporte' },
    { to: '/admin/operations', label: 'Operaciones' },
  ]

  return (
    <div className="admin-dashboard-mobile space-y-4 md:hidden">
      <header className="admin-dashboard-mobile__hero">
        <div>
          <p className="admin-ops-center__kicker">PRODEMUNDIAL 2026</p>
          <h1 className="admin-dashboard-mobile__title">Dashboard</h1>
        </div>
        <AdminStatusLight status={overall} label="Estado" />
      </header>

      <div className="admin-dashboard-mobile__kpi-grid">
        {kpis.map(kpi => (
          <Link key={kpi.label} to={kpi.to} className="admin-premium-card admin-dashboard-mobile__kpi">
            <span className="admin-dashboard-mobile__kpi-label">{kpi.label}</span>
            <span className="admin-dashboard-mobile__kpi-value">{kpi.value}</span>
            <AdminStatusLight status={kpi.state} label="" />
          </Link>
        ))}
      </div>

      <AdminMatchDayCard dashboard={data} scoring={scoring} matches={matches} />

      {alerts.length > 0 && <OperationsAlertCenter alerts={alerts.slice(0, 3)} />}

      {attentionItems.length > 0 && <AdminAttentionPanel items={attentionItems.slice(0, 4)} />}

      <AdminUpcomingMatchesPanel
        upcoming={upcoming}
        matchesById={matchesById}
        predictionCounts={predictionCounts}
        activeUsers={data.active_users}
      />

      {liveFeed.length > 0 && <AdminLiveActivityTimeline items={liveFeed.slice(0, 8)} />}

      <section className="admin-dashboard-mobile__quick">
        <p className="admin-dashboard-mobile__section-title">Accesos rápidos</p>
        <div className="admin-dashboard-mobile__quick-grid">
          {quickLinks.map(l => (
            <Link key={l.to} to={l.to} className="admin-premium-card admin-premium-card--compact admin-dashboard-mobile__quick-link">
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
