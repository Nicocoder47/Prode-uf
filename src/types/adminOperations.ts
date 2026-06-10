import type { HealthStatus } from './admin'

export type AlertSeverity = 'info' | 'success' | 'warning' | 'critical'

export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'critico'

export type OperationalMetric = {
  id: string
  label: string
  value: string | number
  state: HealthStatus
  explanation: string
  suggestedAction: string
  actionTo?: string
  actionLabel?: string
  severity: AlertSeverity
  updatedAt: string
  trend?: string
}

export type OperationalAlert = {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  cause: string
  impact: string
  suggestedAction: string
  actionTo?: string
  actionLabel?: string
  timestamp: string
}

export type OperationalRecommendation = {
  id: string
  priority: 'low' | 'medium' | 'high'
  message: string
  actionTo?: string
  actionLabel?: string
}

export type EnrichedServiceHealth = {
  id: string
  label: string
  status: HealthStatus
  description: string
  lastRun: string | null
  responseMs: number | null
  risk: RiskLevel
  suggestedAction: string
  actionTo?: string
  actionLabel?: string
  detail: string
  lastError: string | null
  history24h: string
  history7d: string
}
