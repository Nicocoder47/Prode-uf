import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdminActivityLogs,
  fetchAdminCardsManage,
  fetchAdminBetaCapacity,
  fetchAdminAnalytics,
  fetchAdminBetaOverview,
  fetchAdminDashboard,
  fetchAdminNotifications,
  fetchAdminScoringCenter,
  fetchAdminSystemHealth,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchMatchPredictionCounts,
  getAdminDataMode,
} from '../services/admin/adminService'
import { POLLING_INTERVALS } from '../config/betaMode'
import type {
  AdminActivityRow,
  AdminAnalyticsOverview,
  AdminBetaCapacity,
  AdminBetaOverview,
  AdminDashboard,
  AdminNotificationRow,
  AdminScoringCenter,
  AdminSystemHealth,
  AdminUserDetail,
  AdminUserRow,
} from '../types/admin'

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  betaCapacity: () => [...adminKeys.all, 'beta-capacity'] as const,
  betaOverview: () => [...adminKeys.all, 'beta-overview'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  userDetail: (id: string) => [...adminKeys.all, 'user', id] as const,
  activity: (filters: string) => [...adminKeys.all, 'activity', filters] as const,
  notifications: () => [...adminKeys.all, 'notifications'] as const,
  cards: () => [...adminKeys.all, 'cards'] as const,
  rpcMode: () => [...adminKeys.all, 'rpc-mode'] as const,
  matchPredictionCounts: (ids: string) => [...adminKeys.all, 'match-prediction-counts', ids] as const,
  scoringCenter: () => [...adminKeys.all, 'scoring-center'] as const,
  systemHealth: () => [...adminKeys.all, 'system-health'] as const,
  analytics: () => [...adminKeys.all, 'analytics'] as const,
}

export function useAdminDashboard() {
  return useQuery<AdminDashboard>({
    queryKey: adminKeys.dashboard(),
    queryFn: fetchAdminDashboard,
    staleTime: 60_000,
  })
}

export function useAdminBetaCapacity() {
  return useQuery<AdminBetaCapacity>({
    queryKey: adminKeys.betaCapacity(),
    queryFn: fetchAdminBetaCapacity,
    staleTime: 60_000,
    refetchInterval: POLLING_INTERVALS.capacity,
  })
}

export function useAdminBetaOverview() {
  return useQuery<AdminBetaOverview>({
    queryKey: adminKeys.betaOverview(),
    queryFn: fetchAdminBetaOverview,
    staleTime: 30_000,
    refetchInterval: POLLING_INTERVALS.capacity,
  })
}

export function useAdminScoringCenter() {
  return useQuery<AdminScoringCenter>({
    queryKey: adminKeys.scoringCenter(),
    queryFn: fetchAdminScoringCenter,
    staleTime: 20_000,
    refetchInterval: 60_000,
  })
}

export function useAdminSystemHealth() {
  return useQuery<AdminSystemHealth>({
    queryKey: adminKeys.systemHealth(),
    queryFn: fetchAdminSystemHealth,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useAdminAnalytics() {
  return useQuery<AdminAnalyticsOverview>({
    queryKey: adminKeys.analytics(),
    queryFn: fetchAdminAnalytics,
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
    invalidateBetaOverview: () => queryClient.invalidateQueries({ queryKey: adminKeys.betaOverview() }),
    invalidateBetaCapacity: () => queryClient.invalidateQueries({ queryKey: adminKeys.betaCapacity() }),
    invalidateUserDetail: (id: string) =>
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(id) }),
    invalidateNotifications: () => queryClient.invalidateQueries({ queryKey: adminKeys.notifications() }),
    invalidateCards: () => queryClient.invalidateQueries({ queryKey: adminKeys.cards() }),
    invalidateActivity: () => queryClient.invalidateQueries({ queryKey: adminKeys.activity('') }),
  }
}
