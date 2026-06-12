import { supabase } from '../../lib/supabase'
import type {
  AdminActivityRow,
  AdminAnalyticsOverview,
  AdminBetaCapacity,
  AdminBetaOverview,
  AdminCard,
  AdminDashboard,
  AdminDeleteUserResult,
  AdminDeletedUserRow,
  AdminRestoreUserResult,
  AdminNotificationRow,
  AdminScoringCenter,
  AdminSystemHealth,
  AdminMatchSyncHealth,
  AdminMatchSyncLogRow,
  AdminTestUserReportRow,
  AdminTestUsersPreview,
  AdminUserDetail,
  AdminUserRow,
  AppNotification,
} from '../../types/admin'
import { ADMIN_RPC_FAIL_MESSAGE, shouldFailClosedOnAdminRpc } from '../../utils/adminFailClosed'

const SYNC_SUCCESS_STATUSES = new Set(['ok', 'done', 'success', 'completed'])

function normalizeAdminSystemHealth(data: AdminSystemHealth): AdminSystemHealth {
  return {
    ...data,
    services: data.services.map(svc => {
      if (svc.id !== 'scheduler') return svc
      const syncStatus = (svc.last_error ?? '').toLowerCase()
      if (!SYNC_SUCCESS_STATUSES.has(syncStatus)) return svc
      return { ...svc, status: 'green', last_error: null }
    }),
  }
}
import {
  adminSetUserActiveFallback,
  adminSetUserRoleFallback,
  adminSoftDeleteUserFallback,
  adminApproveUserFallback,
  adminRejectUserFallback,
  fetchAdminActivityFallback,
  fetchAdminCardsFallback,
  fetchAdminDashboardFallback,
  fetchAdminNotificationsFallback,
  fetchAdminUsersFallback,
  isRpcMissing,
} from './adminServiceFallback'

function unwrap<T>(data: unknown): T {
  return data as T
}

export type AdminDataMode = 'rpc' | 'fallback'

let lastMode: AdminDataMode = 'rpc'

export function getAdminDataMode(): AdminDataMode {
  return lastMode
}

async function withFallback<T>(rpc: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    const result = await rpc()
    lastMode = 'rpc'
    return result
  } catch (err) {
    if (isRpcMissing(err as { message?: string; code?: string })) {
      if (shouldFailClosedOnAdminRpc()) {
        throw new Error(ADMIN_RPC_FAIL_MESSAGE)
      }
      console.warn('[admin] RPC ausente — usando fallback (solo dev)')
      lastMode = 'fallback'
      return fallback()
    }
    throw err
  }
}

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  return withFallback(async () => {
    const { data, error } = await supabase.rpc('admin_get_dashboard')
    if (error) throw error
    return unwrap<AdminDashboard>(data)
  }, fetchAdminDashboardFallback)
}

export async function fetchAdminBetaCapacity(): Promise<AdminBetaCapacity> {
  const { data, error } = await supabase.rpc('admin_get_beta_capacity')
  if (error) throw error
  return unwrap<AdminBetaCapacity>(data)
}

export async function fetchAdminBetaOverview(): Promise<AdminBetaOverview> {
  const { data, error } = await supabase.rpc('admin_get_beta_overview')
  if (error) {
    if (isRpcMissing(error)) {
      throw new Error('Resumen beta requiere migración 260. Ejecutá npm run db:push:cloud')
    }
    throw error
  }
  return unwrap<AdminBetaOverview>(data)
}

export async function adminDeleteUserFull(
  userId: string,
  reason: string,
  confirmation: string,
): Promise<AdminDeleteUserResult> {
  const { data, error } = await supabase.rpc('admin_delete_user_full', {
    p_user_id: userId,
    p_reason: reason,
    p_confirmation: confirmation,
  })
  if (error) throw error
  return unwrap<AdminDeleteUserResult>(data)
}

export async function adminDeleteTestUser(userId: string): Promise<AdminDeleteUserResult> {
  const { data, error } = await supabase.rpc('admin_delete_test_user', { p_user_id: userId })
  if (error) throw error
  return unwrap<AdminDeleteUserResult>(data)
}

export async function fetchAdminDeletedUsers(limit = 30): Promise<AdminDeletedUserRow[]> {
  const { data, error } = await supabase.rpc('admin_list_deleted_users', { p_limit: limit })
  if (error) throw error
  return unwrap<AdminDeletedUserRow[]>(data ?? [])
}

export async function adminRestoreDeletedUser(
  auditId: string,
  fields?: { fullName?: string; dni?: string; legajo?: string },
): Promise<AdminRestoreUserResult> {
  const { data, error } = await supabase.rpc('admin_restore_deleted_user', {
    p_audit_id: auditId,
    p_full_name: fields?.fullName?.trim() || null,
    p_dni: fields?.dni?.trim() || null,
    p_legajo: fields?.legajo?.trim() || null,
  })
  if (error) throw error
  return unwrap<AdminRestoreUserResult>(data)
}

export async function adminResetUserPredictions(userId: string) {
  const { data, error } = await supabase.rpc('admin_reset_user_predictions', { p_user_id: userId })
  if (error) throw error
  return data as { ok: boolean; predictions_deleted: number }
}

export async function adminResetUserScore(userId: string) {
  const { data, error } = await supabase.rpc('admin_reset_user_score', { p_user_id: userId })
  if (error) throw error
  return data as { ok: boolean }
}

export async function adminCountTestUsers(): Promise<AdminTestUsersPreview> {
  const { data, error } = await supabase.rpc('admin_count_test_users')
  if (error) throw error
  return unwrap<AdminTestUsersPreview>(data)
}

export async function adminCleanupTestUsers(confirmation: string) {
  const { data, error } = await supabase.rpc('admin_cleanup_test_users', {
    p_confirmation: confirmation,
  })
  if (error) throw error
  return data as { ok: boolean; deleted_count: number }
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  return withFallback(async () => {
    const { data, error } = await supabase.rpc('admin_get_users')
    if (error) throw error
    return unwrap<AdminUserRow[]>(data ?? [])
  }, fetchAdminUsersFallback)
}

export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const { data, error } = await supabase.rpc('admin_get_user_detail', { p_user_id: userId })
  if (error) {
    if (isRpcMissing(error)) {
      throw new Error('Detalle de usuario requiere migración 170. Ejecutá npm run db:push:cloud')
    }
    throw error
  }
  return unwrap<AdminUserDetail>(data)
}

export async function fetchAdminActivityLogs(filters: {
  type?: string
  legajo?: string
  from?: string
  to?: string
  limit?: number
}): Promise<AdminActivityRow[]> {
  return withFallback(async () => {
    const { data, error } = await supabase.rpc('admin_get_activity_logs', {
      p_type: filters.type || null,
      p_legajo: filters.legajo || null,
      p_from: filters.from || null,
      p_to: filters.to || null,
      p_limit: filters.limit ?? 100,
    })
    if (error) throw error
    return unwrap<AdminActivityRow[]>(data ?? [])
  }, fetchAdminActivityFallback)
}

export async function fetchAdminNotifications(): Promise<AdminNotificationRow[]> {
  return withFallback(async () => {
    const { data, error } = await supabase.rpc('admin_get_notifications')
    if (error) throw error
    return unwrap<AdminNotificationRow[]>(data ?? [])
  }, fetchAdminNotificationsFallback)
}

export async function adminSoftDeleteUser(userId: string, reason: string) {
  const { error } = await supabase.rpc('admin_soft_delete_user', {
    p_user_id: userId,
    p_reason: reason,
  })
  if (error) {
    if (isRpcMissing(error) && !shouldFailClosedOnAdminRpc()) {
      return adminSoftDeleteUserFallback(userId, reason)
    }
    throw error
  }
}

export async function adminSetUserActive(userId: string, active: boolean) {
  return withFallback(
    async () => {
      const { error } = await supabase.rpc('admin_set_user_active', {
        p_user_id: userId,
        p_active: active,
      })
      if (error) throw error
    },
    () => adminSetUserActiveFallback(userId, active),
  )
}

export async function adminSetUserRole(userId: string, role: 'admin' | 'member') {
  return withFallback(
    async () => {
      const { error } = await supabase.rpc('admin_set_user_role', {
        p_user_id: userId,
        p_role: role,
      })
      if (error) throw error
    },
    () => adminSetUserRoleFallback(userId, role),
  )
}

export async function adminApproveUser(userId: string, reason: string) {
  return withFallback(
    async () => {
      const { error } = await supabase.rpc('admin_approve_user', {
        p_user_id: userId,
        p_reason: reason,
      })
      if (error) throw error
    },
    () => adminApproveUserFallback(userId, reason),
  )
}

export async function adminRejectUser(userId: string, reason: string) {
  return withFallback(
    async () => {
      const { error } = await supabase.rpc('admin_reject_user', {
        p_user_id: userId,
        p_reason: reason,
      })
      if (error) throw error
    },
    () => adminRejectUserFallback(userId, reason),
  )
}

export async function adminCreateNotification(input: {
  title: string
  message: string
  targetType: 'all' | 'user' | 'role'
  targetUserId?: string
  targetRole?: string
  expiresAt?: string
}) {
  const { error } = await supabase.rpc('admin_create_notification', {
    p_title: input.title,
    p_message: input.message,
    p_target_type: input.targetType,
    p_target_user_id: input.targetUserId ?? null,
    p_target_role: input.targetRole ?? null,
    p_expires_at: input.expiresAt ?? null,
  })
  if (error) {
    if (isRpcMissing(error)) {
      throw new Error('Notificaciones admin requieren migración SQL. Ejecutá npm run db:push:cloud')
    }
    throw error
  }
}

export async function adminUpdateCard(input: {
  key: string
  title: string
  value?: string
  subtitle?: string
  description?: string
  icon?: string
  status?: string
  orderIndex?: number
  isActive?: boolean
}) {
  const { error } = await supabase.rpc('admin_update_card', {
    p_key: input.key,
    p_title: input.title,
    p_value: input.value ?? null,
    p_subtitle: input.subtitle ?? null,
    p_description: input.description ?? null,
    p_icon: input.icon ?? null,
    p_status: input.status ?? 'neutral',
    p_order_index: input.orderIndex ?? 0,
    p_is_active: input.isActive ?? true,
  })
  if (error) {
    if (isRpcMissing(error)) {
      throw new Error('Cards admin requieren migración SQL. Ejecutá npm run db:push:cloud')
    }
    throw error
  }
}

export async function fetchMyNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('get_my_notifications')
  if (error) {
    if (isRpcMissing(error)) return []
    throw error
  }
  return unwrap<AppNotification[]>(data ?? [])
}

export async function markNotificationRead(notificationId: string) {
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })
  if (error && !isRpcMissing(error)) throw error
}

export async function fetchActiveAdminCards(): Promise<AdminCard[]> {
  return withFallback(async () => {
    const { data, error } = await supabase.rpc('get_active_admin_cards')
    if (error) throw error
    return unwrap<AdminCard[]>(data ?? [])
  }, fetchAdminCardsFallback)
}

/** Todas las cards (activas e inactivas) para gestión admin. */
export async function fetchAdminCardsManage(): Promise<AdminCard[]> {
  const { data, error } = await supabase.from('admin_cards').select('*').order('order_index')
  if (error) {
    return fetchActiveAdminCards()
  }
  return unwrap<AdminCard[]>(data ?? [])
}

export async function fetchMatchPredictionCounts(matchIds: string[]): Promise<Record<string, number>> {
  if (matchIds.length === 0) return {}

  const { data, error } = await supabase.from('predictions').select('match_id').in('match_id', matchIds)
  if (error) throw error

  const counts = Object.fromEntries(matchIds.map(id => [id, 0]))
  for (const row of data ?? []) {
    const matchId = (row as { match_id: string }).match_id
    counts[matchId] = (counts[matchId] ?? 0) + 1
  }
  return counts
}

export async function logUserLogin() {
  const { error } = await supabase.rpc('log_user_login')
  if (error && !isRpcMissing(error)) throw error
}

export async function fetchRegistrationStatus(): Promise<{ enabled: boolean }> {
  const { data, error } = await supabase.rpc('admin_get_registration_status')
  if (error) throw error
  return data as { enabled: boolean }
}

export async function adminSetRegistrationStatus(enabled: boolean) {
  const { error } = await supabase.rpc('admin_set_registration_status', { p_enabled: enabled })
  if (error) throw error
}

export async function adminForcePasswordChange(userId: string) {
  const { error } = await supabase.rpc('admin_force_password_change', { p_user_id: userId })
  if (error) throw error
}

export async function adminBlockUser(userId: string, reason: string) {
  const { error } = await supabase.rpc('admin_block_user', { p_user_id: userId, p_reason: reason })
  if (error) throw error
}

export async function adminUnblockUser(userId: string) {
  const { error } = await supabase.rpc('admin_unblock_user', { p_user_id: userId })
  if (error) throw error
}

export async function adminSetNotificationActive(notificationId: string, active: boolean) {
  const { error } = await supabase.rpc('admin_set_notification_active', {
    p_notification_id: notificationId,
    p_active: active,
  })
  if (error) throw error
}

export async function completePasswordChange() {
  const { error } = await supabase.rpc('complete_password_change')
  if (error) throw error
}

function requireRpc(error: { message?: string; code?: string } | null, migration: string) {
  if (error?.message?.includes('Could not find the function') || error?.code === 'PGRST202') {
    throw new Error(`Requiere migración ${migration}. Ejecutá npm run db:apply:management -- ${migration}`)
  }
  if (error) throw error
}

export async function fetchAdminScoringCenter(): Promise<AdminScoringCenter> {
  const { data, error } = await supabase.rpc('admin_get_scoring_center')
  requireRpc(error, '270')
  return unwrap<AdminScoringCenter>(data)
}

export async function fetchAdminSystemHealth(): Promise<AdminSystemHealth> {
  const { data, error } = await supabase.rpc('admin_get_system_health')
  requireRpc(error, '270')
  return normalizeAdminSystemHealth(unwrap<AdminSystemHealth>(data))
}

function mapSyncLogRow(row: Record<string, unknown>): AdminMatchSyncLogRow {
  return {
    provider: String(row.provider ?? ''),
    sync_type: String(row.sync_type ?? ''),
    status: String(row.status ?? ''),
    records_upserted: Number(row.records_upserted ?? 0),
    records_skipped: Number(row.records_skipped ?? 0),
    error_message: (row.error_message as string | null) ?? null,
    started_at: String(row.started_at ?? ''),
    finished_at: (row.finished_at as string | null) ?? null,
  }
}

/** Salud del sync de resultados (today_results / live_cycle) para alertas admin. */
export async function fetchAdminMatchSyncHealth(): Promise<AdminMatchSyncHealth> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: todayRow }, { data: cycleRow }, { count: errorCount }] = await Promise.all([
    supabase
      .from('data_sync_logs')
      .select('provider,sync_type,status,records_upserted,records_skipped,error_message,started_at,finished_at')
      .eq('sync_type', 'today_results')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('data_sync_logs')
      .select('provider,sync_type,status,records_upserted,records_skipped,error_message,started_at,finished_at')
      .eq('sync_type', 'live_cycle')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('data_sync_logs')
      .select('id', { count: 'exact', head: true })
      .eq('sync_type', 'today_results')
      .eq('status', 'error')
      .gte('started_at', since24h),
  ])

  const lastToday = todayRow ? mapSyncLogRow(todayRow as Record<string, unknown>) : null
  const lastCycle = cycleRow ? mapSyncLogRow(cycleRow as Record<string, unknown>) : null

  let minutesSince: number | null = null
  if (lastToday?.finished_at || lastToday?.started_at) {
    const ts = lastToday.finished_at ?? lastToday.started_at
    minutesSince = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000)
  }

  return {
    last_today_results: lastToday,
    last_live_cycle: lastCycle,
    minutes_since_today_results: minutesSince,
    today_results_errors_24h: errorCount ?? 0,
  }
}

export async function fetchAdminAnalytics(): Promise<AdminAnalyticsOverview> {
  const { data, error } = await supabase.rpc('admin_get_analytics_overview')
  requireRpc(error, '270')
  return unwrap<AdminAnalyticsOverview>(data)
}

export async function fetchAdminTestUsersReport(): Promise<AdminTestUserReportRow[]> {
  const { data, error } = await supabase.rpc('admin_get_test_users_report')
  requireRpc(error, '270')
  return unwrap<AdminTestUserReportRow[]>(data ?? [])
}

export async function adminUpdateMatchResult(input: {
  matchId: string
  scoreHome: number
  scoreAway: number
  status?: 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed' | 'cancelled'
}) {
  const { error } = await supabase
    .from('matches')
    .update({
      score_home: input.scoreHome,
      score_away: input.scoreAway,
      status: input.status ?? 'finished',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.matchId)

  if (error) throw error
}

export async function adminScoreMatch(matchId: string) {
  const { data, error } = await supabase.rpc('admin_score_match', { p_match_id: matchId })
  requireRpc(error, '270')
  return data as { ok: boolean; predictions_scored: number }
}

export async function adminRescoreMatch(matchId: string, oldHome: number, oldAway: number) {
  const { data, error } = await supabase.rpc('admin_rescore_match', {
    p_match_id: matchId,
    p_old_score_home: oldHome,
    p_old_score_away: oldAway,
  })
  requireRpc(error, '270')
  return data as { ok: boolean; predictions_rescored: number }
}

export async function adminRecalculateLeaderboard() {
  const { data, error } = await supabase.rpc('admin_recalculate_leaderboard')
  requireRpc(error, '270')
  return data as { ok: boolean }
}

export async function adminRebuildLeaderboardFromPredictions() {
  const { data, error } = await supabase.rpc('admin_rebuild_leaderboard_from_predictions')
  requireRpc(error, '290')
  return data as { ok: boolean; users_rebuilt: number; rows_removed: number }
}

export async function adminScoreRound(round: string) {
  const { data, error } = await supabase.rpc('admin_score_round', { p_round: round })
  requireRpc(error, '270')
  return data as { ok: boolean; matches_processed: number; predictions_scored: number }
}
