import { useMemo } from 'react'
import {
  useAdminBetaCapacity,
  useAdminBetaOverview,
  useAdminDashboard,
  useAdminScoringCenter,
  useAdminSystemHealth,
} from './useAdminQueries'
import { buildOperationalAlerts } from '../utils/adminOperationsEngine'

export function useAdminAlerts() {
  const { data: dashboard, isLoading: loadingDashboard } = useAdminDashboard()
  const { data: betaCapacity } = useAdminBetaCapacity()
  const { data: betaOverview } = useAdminBetaOverview()
  const { data: health } = useAdminSystemHealth()
  const { data: scoring } = useAdminScoringCenter()

  const alerts = useMemo(
    () =>
      buildOperationalAlerts({
        dashboard,
        capacity: betaCapacity,
        overview: betaOverview,
        health,
        scoring,
      }),
    [dashboard, betaCapacity, betaOverview, health, scoring],
  )

  return { alerts, isLoading: loadingDashboard }
}
