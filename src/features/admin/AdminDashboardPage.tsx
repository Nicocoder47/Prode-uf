import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import {
  AdminAttentionPanel,
  AdminCompetitionPodium,
  AdminLiveActivityTimeline,
  AdminSupportSnapshot,
  AdminSystemHealthNoc,
  AdminUpcomingMatchesPanel,
  AdminWorldCupStatus,
} from '../../components/admin/controlCenter'
import { AdminBeta300Status } from '../../components/admin/AdminBeta300Status'
import { AdminBetaOverviewCards } from '../../components/admin/AdminBetaOverviewCards.tsx'
import {
  ExecutiveMetricsGrid,
  OperationsAlertCenter,
  OperationsRecommendationBar,
} from '../../components/admin/enterprise'
import { AdminStatusLight } from '../../components/admin/AdminStatusLight.tsx'
import { useAdminSupportTickets } from '../../hooks/useSupportTickets'
import {
  useAdminActivityLogs,
  useAdminBetaCapacity,
  useAdminBetaOverview,
  useAdminDashboard,
  useAdminScoringCenter,
  useAdminSystemHealth,
  useMatchPredictionCounts,
} from '../../hooks/useAdminQueries.ts'
import { useWorldCupMatches } from '../../useWorldCupData'
import {
  buildAttentionItems,
  buildLiveFeed,
  buildSystemHealth,
  supportTicketCounts,
} from '../../utils/adminControlCenter'
import {
  buildCapacityMetrics,
  buildExecutiveUserMetrics,
  buildOperationalAlerts,
  buildOperationalRecommendations,
  overallStatusFromAlerts,
} from '../../utils/adminOperationsEngine.ts'

export default function AdminDashboardPage() {
  const { data, error, isLoading } = useAdminDashboard()
  const { data: betaCapacity } = useAdminBetaCapacity()
  const { data: betaOverview } = useAdminBetaOverview()
  const { data: health } = useAdminSystemHealth()
  const { data: scoring } = useAdminScoringCenter()
  const { data: tickets = [] } = useAdminSupportTickets()
  const { data: matches = [] } = useWorldCupMatches()
  const { data: fallbackActivity = [] } = useAdminActivityLogs(
    { limit: 20 },
    Boolean(data && (data.latest_activity_logs?.length ?? 0) === 0),
  )

  const upcoming = useMemo(() => (data?.upcoming_matches ?? []).slice(0, 5), [data?.upcoming_matches])
  const upcomingIds = useMemo(() => upcoming.map(m => m.id), [upcoming])
  const { data: predictionCounts = {} } = useMatchPredictionCounts(upcomingIds)

  const matchesById = useMemo(() => new Map(matches.map(m => [m.id, m])), [matches])

  const activityLogs = useMemo(
    () => (data?.latest_activity_logs?.length ? data.latest_activity_logs : fallbackActivity),
    [data?.latest_activity_logs, fallbackActivity],
  )

  const attentionItems = useMemo(
    () => (data ? buildAttentionItems(data, tickets) : []),
    [data, tickets],
  )

  const healthItems = useMemo(
    () =>
      data
        ? buildSystemHealth(data, tickets, Boolean(error), activityLogs)
        : [],
    [data, tickets, error, activityLogs],
  )

  const liveFeed = useMemo(
    () => buildLiveFeed(activityLogs, tickets, 20),
    [activityLogs, tickets],
  )

  const ticketCounts = useMemo(() => supportTicketCounts(tickets), [tickets])

  const userMetrics = useMemo(
    () => (data ? buildExecutiveUserMetrics(data, betaCapacity, betaOverview) : []),
    [data, betaCapacity, betaOverview],
  )

  const capacityMetrics = useMemo(
    () => buildCapacityMetrics(betaCapacity, betaOverview),
    [betaCapacity, betaOverview],
  )

  const alerts = useMemo(
    () =>
      buildOperationalAlerts({
        dashboard: data,
        capacity: betaCapacity,
        overview: betaOverview,
        health,
        scoring,
      }),
    [data, betaCapacity, betaOverview, health, scoring],
  )

  const recommendations = useMemo(
    () => buildOperationalRecommendations(alerts, betaCapacity),
    [alerts, betaCapacity],
  )

  const overall = overallStatusFromAlerts(alerts)

  if (isLoading) {
    return (
      <div className="admin-ops-skeleton space-y-4">
        <div className="admin-ops-skeleton__bar" />
        <div className="admin-ops-skeleton__grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="admin-ops-skeleton__card" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <PremiumCard variant="dark" title="Error">
        <p className="text-red-300">{error instanceof Error ? error.message : 'Sin datos del dashboard'}</p>
      </PremiumCard>
    )
  }

  return (
    <div className="admin-control-center admin-ops-center space-y-6">
      <header className="admin-ops-center__hero">
        <div>
          <p className="admin-ops-center__kicker">PRODEMUNDIAL 2026</p>
          <h1 className="admin-ops-center__title">Centro de Operaciones</h1>
          <p className="admin-ops-center__subtitle">
            NOC ejecutivo — usuarios, capacidad, alertas y competencia en una sola vista.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <AdminStatusLight status={overall} label="Estado general" />
          <Link to="/admin/operations" className="admin-ops-metric__cta">
            Vista enterprise completa →
          </Link>
        </div>
      </header>

      <OperationsRecommendationBar items={recommendations} />

      <ExecutiveMetricsGrid title="Usuarios" kicker="Sección 1 · Ejecutivo" metrics={userMetrics} />
      <ExecutiveMetricsGrid title="Capacidad" kicker="Beta 300" metrics={capacityMetrics} />

      <OperationsAlertCenter alerts={alerts.slice(0, 4)} />

      {betaOverview && <AdminBetaOverviewCards data={betaOverview} />}
      {betaCapacity && <AdminBeta300Status data={betaCapacity} />}

      <AdminWorldCupStatus
        registered={data.total_users}
        active={data.active_users}
        predictions={data.total_predictions}
        scheduled={data.scheduled_matches}
        finished={data.finished_matches}
        openTickets={ticketCounts.open}
      />

      <div className="admin-control-center__grid admin-control-center__grid--2">
        <AdminAttentionPanel items={attentionItems} />
        <AdminSystemHealthNoc items={healthItems} />
      </div>

      <div className="admin-control-center__grid admin-control-center__grid--2">
        <AdminLiveActivityTimeline items={liveFeed} />
        <AdminCompetitionPodium ranking={data.top_10_ranking ?? []} />
      </div>

      <div className="admin-control-center__grid admin-control-center__grid--2">
        <AdminUpcomingMatchesPanel
          upcoming={upcoming}
          matchesById={matchesById}
          predictionCounts={predictionCounts}
          activeUsers={data.active_users}
        />
        <AdminSupportSnapshot
          open={ticketCounts.open}
          inReview={ticketCounts.inReview}
          resolved={ticketCounts.resolved}
        />
      </div>
    </div>
  )
}
