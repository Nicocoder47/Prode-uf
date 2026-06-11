import { useMemo } from 'react'
import {
  useAdminBetaCapacity,
  useAdminBetaOverview,
  useAdminDashboard,
  useAdminScoringCenter,
  useAdminSystemHealth,
  useAdminMatchSyncHealth,
} from './useAdminQueries'
import { buildOperationalAlerts } from '../utils/adminOperationsEngine'

export function useAdminAlerts() {
  const { data: dashboard, isLoading: loadingDashboard } = useAdminDashboard()
  const { data: betaCapacity } = useAdminBetaCapacity()
  const { data: betaOverview } = useAdminBetaOverview()
  const { data: health } = useAdminSystemHealth()
  const { data: matchSync } = useAdminMatchSyncHealth()
  const { data: scoring } = useAdminScoringCenter()

  const alerts = useMemo(
    () =>
      buildOperationalAlerts({
        dashboard,
        capacity: betaCapacity,
        overview: betaOverview,
        health,
        matchSync,
        scoring,
      }),
    [dashboard, betaCapacity, betaOverview, health, matchSync, scoring],
  )

  return { alerts, isLoading: loadingDashboard }
}
