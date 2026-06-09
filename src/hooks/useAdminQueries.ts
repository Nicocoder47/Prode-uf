import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdminActivityLogs,
  fetchAdminCardsManage,
  fetchAdminDashboard,
  fetchAdminNotifications,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchMatchPredictionCounts,
  getAdminDataMode,
} from '../services/admin/adminService'
import type { AdminActivityRow, AdminDashboard, AdminNotificationRow, AdminUserDetail, AdminUserRow } from '../types/admin'

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userDetail: (id: string) => [...adminKeys.all, 'user', id] as const,
  activity: (filters: string) => [...adminKeys.all, 'activity', filters] as const,
  notifications: () => [...adminKeys.all, 'notifications'] as const,
  cards: () => [...adminKeys.all, 'cards'] as const,
  rpcMode: () => [...adminKeys.all, 'rpc-mode'] as const,
  matchPredictionCounts: (ids: string) => [...adminKeys.all, 'match-prediction-counts', ids] as const,
}

export function useAdminDashboard() {
  return useQuery<AdminDashboard>({
    queryKey: adminKeys.dashboard(),
    queryFn: fetchAdminDashboard,
    staleTime: 60_000,
  })
}

export function useAdminUsers() {
  return useQuery<AdminUserRow[]>({
    queryKey: adminKeys.users(),
    queryFn: fetchAdminUsers,
    staleTime: 30_000,
  })
}

export function useAdminUserDetail(userId: string | null) {
  return useQuery<AdminUserDetail>({
    queryKey: adminKeys.userDetail(userId ?? ''),
    queryFn: () => fetchAdminUserDetail(userId!),
    enabled: Boolean(userId),
    staleTime: 15_000,
  })
}

export type AdminActivityFilters = {
  type?: string
  legajo?: string
  from?: string
  to?: string
  limit?: number
}

function activityFilterKey(filters: AdminActivityFilters) {
  return JSON.stringify(filters)
}

export function useAdminActivityLogs(filters: AdminActivityFilters, enabled = true) {
  return useQuery<AdminActivityRow[]>({
    queryKey: adminKeys.activity(activityFilterKey(filters)),
    queryFn: () => fetchAdminActivityLogs(filters),
    enabled,
    staleTime: 20_000,
  })
}

export function useAdminNotifications() {
  return useQuery<AdminNotificationRow[]>({
    queryKey: adminKeys.notifications(),
    queryFn: fetchAdminNotifications,
    staleTime: 30_000,
  })
}

export function useAdminCards() {
  return useQuery({
    queryKey: adminKeys.cards(),
    queryFn: fetchAdminCardsManage,
    staleTime: 30_000,
  })
}

export function useAdminRpcMode() {
  return useQuery({
    queryKey: adminKeys.rpcMode(),
    queryFn: async () => {
      await fetchAdminDashboard()
      return getAdminDataMode()
    },
    staleTime: 5 * 60_000,
  })
}

export function useMatchPredictionCounts(matchIds: string[]) {
  const key = matchIds.slice().sort().join(',')
  return useQuery<Record<string, number>>({
    queryKey: adminKeys.matchPredictionCounts(key),
    queryFn: () => fetchMatchPredictionCounts(matchIds),
    enabled: matchIds.length > 0,
    staleTime: 30_000,
  })
}

export function useInvalidateAdmin() {
  const queryClient = useQueryClient()
  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
    invalidateUsers: () => queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
    invalidateDashboard: () => queryClient.invalidateQueries({ queryKey: adminKeys.dashboard() }),
    invalidateUserDetail: (id: string) =>
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(id) }),
    invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: adminKeys.notifications() }),
    invalidateCards: () => queryClient.invalidateQueries({ queryKey: adminKeys.cards() }),
    invalidateActivity: () => queryClient.invalidateQueries({ queryKey: adminKeys.activity('') }),
  }
}
