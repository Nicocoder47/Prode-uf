import { useMemo } from 'react'
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
import { useAdminSupportTickets } from '../../hooks/useSupportTickets'
import { useAdminActivityLogs, useAdminDashboard, useMatchPredictionCounts } from '../../hooks/useAdminQueries.ts'
import { useWorldCupMatches } from '../../useWorldCupData'
import {
  buildAttentionItems,
  buildLiveFeed,
  buildSystemHealth,
  supportTicketCounts,
} from '../../utils/adminControlCenter'

export default function AdminDashboardPage() {
  const { data, error, isLoading } = useAdminDashboard()
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

  if (isLoading) {
    return <p className="text-white/70">Cargando centro de control…</p>
  }

  if (error || !data) {
    return (
      <PremiumCard variant="dark" title="Error">
        <p className="text-red-300">{error instanceof Error ? error.message : 'Sin datos del dashboard'}</p>
      </PremiumCard>
    )
  }

  return (
    <div className="admin-control-center space-y-5">
      <header className="admin-control-center__header">
        <p className="admin-control-center__kicker">Admin V2</p>
        <h1 className="admin-control-center__title">World Cup Control Center</h1>
        <p className="admin-control-center__subtitle">
          Estado completo del Mundial en una sola vista — usuarios, fixture, sync, competencia y soporte.
        </p>
      </header>

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
