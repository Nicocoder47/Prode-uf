import { supabase } from '../../lib/supabase'
import type {
  AdminActivityRow,
  AdminBetaCapacity,
  AdminBetaOverview,
  AdminCard,
  AdminDashboard,
  AdminDeleteUserResult,
  AdminNotificationRow,
  AdminTestUsersPreview,
  AdminUserDetail,
  AdminUserRow,
  AppNotification,
} from '../../types/admin'
import { ADMIN_RPC_FAIL_MESSAGE, shouldFailClosedOnAdminRpc } from '../../utils/adminFailClosed'
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
