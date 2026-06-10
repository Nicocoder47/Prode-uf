import type { AdminBetaCapacity } from '../../types/admin'
import {
  MAX_BETA_USERS,
  WARN_USERS,
  CRITICAL_USERS,
  WARN_CONCURRENT_USERS,
  CRITICAL_CONCURRENT_USERS,
} from '../../config/betaMode'

export type AlertLevel = 'info' | 'warning' | 'critical'

export type BetaAlert = {
  level: AlertLevel
  title: string
  explanation: string
  action: string
}

const LEVEL_STYLES: Record<AlertLevel, string> = {
  info: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
  warning: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
  critical: 'border-red-400/30 bg-red-500/10 text-red-100',
}

function buildAlerts(data: AdminBetaCapacity): BetaAlert[] {
  const alerts: BetaAlert[] = []
  const users = data.registered_users
  const dh = data.device_health

  if (users > MAX_BETA_USERS) {
    alerts.push({
      level: 'critical',
      title: 'Beta 300 excedida',
      explanation: `${users} usuarios registrados (límite ${MAX_BETA_USERS}).`,
      action: 'Desactivar invitaciones y preparar migración.',
    })
  } else if (users > CRITICAL_USERS) {
    alerts.push({
      level: 'critical',
      title: 'Límite crítico de beta 300',
      explanation: `${users} usuarios registrados (≥ ${CRITICAL_USERS}). No abrir más invitaciones.`,
      action: 'Cerrar invitaciones y preparar migración a Supabase Pro.',
    })
  } else if (users > WARN_USERS) {
    alerts.push({
      level: 'warning',
      title: 'Acercándose al límite beta',
      explanation: `${users} usuarios registrados (≥ ${WARN_USERS}).`,
      action: 'Monitorear diariamente y frenar campañas de registro.',
    })
  }

  if (data.active_users_24h > 100) {
    alerts.push({
      level: 'warning',
      title: 'Alta actividad 24h',
      explanation: `${data.active_users_24h} usuarios activos en las últimas 24 horas.`,
      action: 'Revisar latencia y picos durante partidos.',
    })
  }

  if (data.predictions_24h > 500) {
    alerts.push({
      level: 'warning',
      title: 'Pico de predicciones',
      explanation: `${data.predictions_24h} predicciones en 24h.`,
      action: 'Verificar save_prediction y cola de scoring.',
    })
  }

  if (data.estimated_concurrent_users >= CRITICAL_CONCURRENT_USERS) {
    alerts.push({
      level: 'critical',
      title: 'Concurrencia crítica estimada',
      explanation: `~${data.estimated_concurrent_users} usuarios simultáneos (≥ ${CRITICAL_CONCURRENT_USERS}).`,
      action: 'Evitar apertura masiva; preparar migración.',
    })
  } else if (data.estimated_concurrent_users >= WARN_CONCURRENT_USERS) {
    alerts.push({
      level: 'warning',
      title: 'Concurrencia elevada',
      explanation: `~${data.estimated_concurrent_users} usuarios simultáneos estimados.`,
      action: 'Monitorear durante ventanas de partido.',
    })
  }

  if (data.save_p95_ms != null && data.save_p95_ms > 3000) {
    alerts.push({
      level: 'critical',
      title: 'save_prediction lento',
      explanation: `p95 ~${Math.round(data.save_p95_ms)}ms (umbral 3000ms).`,
      action: 'Reducir concurrencia o migrar a Supabase Pro.',
    })
  }

  if (data.read_p95_ms != null && data.read_p95_ms > 4000) {
    alerts.push({
      level: 'warning',
      title: 'Lecturas lentas',
      explanation: `p95 lectura ~${Math.round(data.read_p95_ms)}ms (umbral 4000ms).`,
      action: 'Confirmar polling activo y evitar queries pesadas en home.',
    })
  }

  if ((data.auth_errors_429_24h ?? 0) > 0) {
    alerts.push({
      level: 'critical',
      title: 'Errores Auth 429',
      explanation: `${data.auth_errors_429_24h} errores de rate limit en 24h.`,
      action: 'Espaciar registros/logins; considerar Supabase Pro.',
    })
  }

  if (data.recent_sync_errors_24h > 0) {
    alerts.push({
      level: 'warning',
      title: 'Errores de sync',
      explanation: `${data.recent_sync_errors_24h} fallos de sync en 24h.`,
      action: 'Revisar GitHub Actions y data_sync_logs.',
    })
  }

  if (dh && dh.error_rate > 5) {
    alerts.push({
      level: 'warning',
      title: 'Tasa de errores en dispositivos',
      explanation: `${dh.error_rate}% de reportes son errores (24h).`,
      action: 'Revisar rutas con más fallos y probar en mobile.',
    })
  }

  if (dh && dh.mobile_error_share_pct > 60 && dh.errors_24h > 0) {
    alerts.push({
      level: 'warning',
      title: 'Mobile concentra errores',
      explanation: `${dh.mobile_error_share_pct}% de errores provienen de mobile.`,
      action: 'Priorizar QA en Android/iOS y rutas top_error_routes.',
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      level: 'info',
      title: 'Beta 300 estable',
      explanation: 'Sin alertas activas. Métricas dentro de umbrales.',
      action: 'Seguir monitoreando con beta:300-report.',
    })
  }

  return alerts
}

type Props = {
  data: AdminBetaCapacity
}

export function BetaCapacityAlerts({ data }: Props) {
  const alerts = buildAlerts(data)

  return (
    <div className="space-y-3">
      {alerts.map(alert => (
        <div
          key={`${alert.level}-${alert.title}`}
          className={`rounded-xl border px-4 py-3 ${LEVEL_STYLES[alert.level]}`}
        >
          <p className="text-xs font-bold uppercase tracking-wider opacity-75">{alert.level}</p>
          <p className="mt-1 font-extrabold">{alert.title}</p>
          <p className="mt-1 text-sm opacity-90">{alert.explanation}</p>
          <p className="mt-2 text-sm font-semibold opacity-95">→ {alert.action}</p>
        </div>
      ))}
    </div>
  )
}
