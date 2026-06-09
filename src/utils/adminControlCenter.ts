import type { AdminActivityRow, AdminDashboard } from '../types/admin'
import type { UserSupportTicket } from '../types/support'

export type HealthLevel = 'ok' | 'warning' | 'error'

export type AttentionItem = {
  id: string
  level: 'error' | 'warning'
  message: string
  ctaLabel: string
  ctaTo: string
}

export type SystemHealthItem = {
  id: string
  label: string
  status: HealthLevel
  detail: string
}

export type LiveFeedItem = {
  id: string
  type: string
  title: string
  subtitle: string
  createdAt: string
  source: 'activity' | 'support'
}

const SYNC_STALE_MINUTES = 30
const MATCH_SOON_MINUTES = 120

export function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}

export function formatRelativeMinutes(minutes: number | null): string {
  if (minutes == null) return '—'
  if (minutes < 1) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.floor(hours / 24)} d`
}

function syncLogMatchesHint(log: AdminActivityRow, hint: string): boolean {
  const blob = `${log.title} ${log.description ?? ''} ${JSON.stringify(log.metadata ?? {})}`.toLowerCase()
  return blob.includes(hint)
}

function resolveSyncStatus(
  dashboard: AdminDashboard,
  activityLogs: AdminActivityRow[],
  hint: string,
): { status: HealthLevel; detail: string } {
  const recent = activityLogs.find(
    l =>
      (l.type === 'sync_completed' || l.type === 'sync_failed') && syncLogMatchesHint(l, hint),
  )
  if (recent?.type === 'sync_failed') {
    return { status: 'error', detail: 'Último sync falló' }
  }
  if (recent) {
    const mins = minutesSince(recent.created_at)
    if (mins != null && mins > SYNC_STALE_MINUTES) {
      return { status: 'warning', detail: formatRelativeMinutes(mins) }
    }
    return { status: 'ok', detail: formatRelativeMinutes(mins) }
  }

  const last = dashboard.last_sync
  if (!last) return { status: 'warning', detail: 'Sin registros' }

  const mins = minutesSince(last.started_at)
  const matchesLast = last.sync_type.toLowerCase().includes(hint)
  if (matchesLast && last.status === 'ok') {
    if (mins != null && mins > SYNC_STALE_MINUTES) {
      return { status: 'warning', detail: formatRelativeMinutes(mins) }
    }
    return { status: 'ok', detail: formatRelativeMinutes(mins) }
  }

  if (mins != null && mins > SYNC_STALE_MINUTES * 2) {
    return { status: 'warning', detail: 'Sin sync reciente de este tipo' }
  }
  return { status: 'ok', detail: 'Operativo' }
}

export function buildAttentionItems(
  dashboard: AdminDashboard,
  tickets: UserSupportTicket[],
): AttentionItem[] {
  const items: AttentionItem[] = []

  const reviewCount = dashboard.users_review_required ?? 0
  if (reviewCount > 0) {
    items.push({
      id: 'review',
      level: 'error',
      message: `${reviewCount} usuario${reviewCount === 1 ? '' : 's'} requieren revisión`,
      ctaLabel: 'Revisar usuarios',
      ctaTo: '/admin/users',
    })
  }

  const openTickets = tickets.filter(t => t.status === 'open').length
  if (openTickets > 0) {
    items.push({
      id: 'tickets-open',
      level: 'error',
      message: `${openTickets} ticket${openTickets === 1 ? '' : 's'} abierto${openTickets === 1 ? '' : 's'}`,
      ctaLabel: 'Ir a soporte',
      ctaTo: '/admin/support',
    })
  }

  const inReviewTickets = tickets.filter(t => t.status === 'in_review').length
  if (inReviewTickets > 0) {
    items.push({
      id: 'tickets-review',
      level: 'warning',
      message: `${inReviewTickets} ticket${inReviewTickets === 1 ? '' : 's'} en revisión`,
      ctaLabel: 'Ver soporte',
      ctaTo: '/admin/support',
    })
  }

  const syncMins = minutesSince(dashboard.last_sync?.started_at)
  if (syncMins == null && !dashboard.last_sync) {
    items.push({
      id: 'sync-missing',
      level: 'warning',
      message: 'Sin registros de sync',
      ctaLabel: 'Ver sistema',
      ctaTo: '/admin/system',
    })
  } else if (syncMins != null && syncMins > SYNC_STALE_MINUTES) {
    items.push({
      id: 'sync-stale',
      level: 'warning',
      message: `Último sync hace ${syncMins} min`,
      ctaLabel: 'Ver sistema',
      ctaTo: '/admin/system',
    })
  } else if (dashboard.last_sync?.status && dashboard.last_sync.status !== 'ok') {
    items.push({
      id: 'sync-error',
      level: 'error',
      message: `Sync en estado ${dashboard.last_sync.status}`,
      ctaLabel: 'Ver sistema',
      ctaTo: '/admin/system',
    })
  }

  const soonMatches = (dashboard.upcoming_matches ?? []).filter(m => {
    const mins = (new Date(m.kick_off).getTime() - Date.now()) / 60_000
    return mins >= 0 && mins <= MATCH_SOON_MINUTES
  })
  if (soonMatches.length > 0) {
    items.push({
      id: 'matches-soon',
      level: 'warning',
      message: `${soonMatches.length} partido${soonMatches.length === 1 ? '' : 's'} en menos de 2 h`,
      ctaLabel: 'Ver fixture',
      ctaTo: '/matches',
    })
  }

  return items
}

export function buildSystemHealth(
  dashboard: AdminDashboard,
  tickets: UserSupportTicket[],
  hasDashboardError: boolean,
  activityLogs: AdminActivityRow[],
): SystemHealthItem[] {
  const openTickets = tickets.filter(t => t.status === 'open').length
  const supportStatus: HealthLevel =
    openTickets >= 5 ? 'error' : openTickets > 0 ? 'warning' : 'ok'

  const scoringFail = activityLogs.some(
    l => l.type === 'sync_failed' && syncLogMatchesHint(l, 'score'),
  )
  const scoringOk = activityLogs.some(l => l.type === 'score_calculated')
  let scoringStatus: HealthLevel = 'ok'
  let scoringDetail = 'Sin partidos finalizados'
  if (dashboard.finished_matches > 0) {
    if (scoringFail) {
      scoringStatus = 'error'
      scoringDetail = 'Fallo reciente en scoring'
    } else if (scoringOk) {
      scoringStatus = 'ok'
      scoringDetail = 'Scoring reciente OK'
    } else {
      scoringStatus = 'warning'
      scoringDetail = 'Sin eventos de scoring recientes'
    }
  }

  const supabaseStatus: HealthLevel = hasDashboardError ? 'error' : 'ok'

  const liveSync = resolveSyncStatus(dashboard, activityLogs, 'live')
  const fixtureSync = resolveSyncStatus(dashboard, activityLogs, 'fixture')

  return [
    {
      id: 'supabase',
      label: 'Supabase',
      status: supabaseStatus,
      detail: hasDashboardError ? 'RPC dashboard falló' : 'RPC operativo',
    },
    {
      id: 'sync-live',
      label: 'Sync Live',
      status: liveSync.status,
      detail: liveSync.detail,
    },
    {
      id: 'sync-fixtures',
      label: 'Sync Fixtures',
      status: fixtureSync.status,
      detail: fixtureSync.detail,
    },
    {
      id: 'scoring',
      label: 'Scoring',
      status: scoringStatus,
      detail: scoringDetail,
    },
    {
      id: 'support',
      label: 'Soporte',
      status: supportStatus,
      detail: openTickets > 0 ? `${openTickets} abierto${openTickets === 1 ? '' : 's'}` : 'Sin pendientes',
    },
  ]
}

const ACTIVITY_LABELS: Record<string, string> = {
  user_registered: 'Registro',
  user_login: 'Login',
  prediction_created: 'Predicción',
  prediction_updated: 'Predicción editada',
  user_manually_approved: 'Aprobación',
  user_rejected: 'Rechazo',
  user_blocked: 'Bloqueo',
  user_unblocked: 'Desbloqueo',
  user_deleted: 'Eliminación',
  score_calculated: 'Scoring',
  sync_completed: 'Sync OK',
  sync_failed: 'Sync fallido',
  notification_created: 'Notificación',
}

export function buildLiveFeed(
  activityLogs: AdminActivityRow[],
  tickets: UserSupportTicket[],
  limit = 20,
): LiveFeedItem[] {
  const fromActivity: LiveFeedItem[] = activityLogs.map(log => ({
    id: `act-${log.id}`,
    type: ACTIVITY_LABELS[log.type] ?? log.type,
    title: log.title,
    subtitle: log.full_name ?? log.legajo ?? log.description ?? '—',
    createdAt: log.created_at,
    source: 'activity',
  }))

  const fromTickets: LiveFeedItem[] = tickets.slice(0, 8).map(ticket => ({
    id: `tkt-${ticket.id}`,
    type: 'Ticket',
    title: ticket.subject,
    subtitle: `${ticket.profile?.fullName ?? 'Usuario'} · ${ticket.status}`,
    createdAt: ticket.createdAt,
    source: 'support',
  }))

  return [...fromActivity, ...fromTickets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export function supportTicketCounts(tickets: UserSupportTicket[]) {
  return {
    open: tickets.filter(t => t.status === 'open').length,
    inReview: tickets.filter(t => t.status === 'in_review').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  }
}

export function formatKickoffCountdown(kickOff: string): string {
  const diff = new Date(kickOff).getTime() - Date.now()
  if (diff <= 0) return 'En curso o finalizado'
  const totalMinutes = Math.floor(diff / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
