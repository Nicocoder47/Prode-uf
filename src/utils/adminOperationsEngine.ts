import { MAX_BETA_USERS } from '../config/betaMode'
import type {
  AdminBetaCapacity,
  AdminBetaOverview,
  AdminDashboard,
  AdminScoringCenter,
  AdminSystemHealth,
  HealthStatus,
} from '../types/admin'
import type {
  AlertSeverity,
  EnrichedServiceHealth,
  OperationalAlert,
  OperationalMetric,
  OperationalRecommendation,
  RiskLevel,
} from '../types/adminOperations'
import { minutesSince, formatRelativeMinutes } from './adminControlCenter'

const SYNC_OK = new Set(['ok', 'done', 'success', 'completed'])

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function riskFromStatus(status: HealthStatus): RiskLevel {
  if (status === 'green') return 'bajo'
  if (status === 'yellow') return 'medio'
  return status === 'red' ? 'critico' : 'alto'
}

function growthPct(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? '+100%' : '0%'
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  return `${pct >= 0 ? '+' : ''}${pct}%`
}

export function buildExecutiveUserMetrics(
  dashboard: AdminDashboard,
  capacity: AdminBetaCapacity | null | undefined,
  overview: AdminBetaOverview | null | undefined,
  now = new Date().toISOString(),
): OperationalMetric[] {
  const registered = capacity?.registered_users ?? dashboard.total_users
  const today = capacity?.new_users_today ?? dashboard.today_registrations
  const week = capacity?.new_users_7d ?? 0
  const active24h = capacity?.active_users_24h ?? dashboard.active_users
  const active7d = capacity?.active_users_7d ?? dashboard.active_users
  const weekPrev = Math.max(1, week - today)

  return [
    {
      id: 'users-today',
      label: 'Registrados hoy',
      value: today,
      state: today > 20 ? 'yellow' : 'green',
      explanation: 'Nuevas altas en las últimas 24 horas.',
      suggestedAction: today > 20 ? 'Monitorear cupo beta y velocidad de registro.' : 'Sin acción requerida.',
      severity: today > 20 ? 'warning' : 'info',
      updatedAt: now,
    },
    {
      id: 'users-week',
      label: 'Registrados semana',
      value: week,
      state: 'green',
      explanation: 'Altas acumuladas en los últimos 7 días.',
      suggestedAction: 'Comparar con proyección de capacidad.',
      trend: growthPct(week, weekPrev),
      severity: 'info',
      updatedAt: now,
    },
    {
      id: 'users-total',
      label: 'Registrados total',
      value: registered,
      state: registered >= MAX_BETA_USERS * 0.93 ? 'red' : registered >= MAX_BETA_USERS * 0.8 ? 'yellow' : 'green',
      explanation: `Total de cuentas activas en la plataforma (cupo beta: ${MAX_BETA_USERS}).`,
      suggestedAction: registered >= MAX_BETA_USERS * 0.9 ? 'Evaluar ampliar beta o cerrar invitaciones.' : 'Seguir monitoreando.',
      actionTo: '/admin/beta-capacity',
      actionLabel: 'Ver capacidad',
      severity: registered >= MAX_BETA_USERS * 0.93 ? 'critical' : 'info',
      updatedAt: now,
    },
    {
      id: 'active-24h',
      label: 'Activos 24 h',
      value: active24h,
      state: active24h > 0 ? 'green' : 'yellow',
      explanation: 'Usuarios con login o actividad en las últimas 24 horas.',
      suggestedAction: active24h === 0 ? 'Revisar campaña de reactivación.' : 'Saludable.',
      severity: 'info',
      updatedAt: now,
    },
    {
      id: 'active-7d',
      label: 'Activos 7 días',
      value: active7d,
      state: 'green',
      explanation: 'Usuarios con actividad en la última semana.',
      suggestedAction: 'Usar para estimar concurrencia pico.',
      severity: 'info',
      updatedAt: now,
    },
    {
      id: 'growth',
      label: 'Crecimiento semanal',
      value: growthPct(week, weekPrev),
      state: week > 50 ? 'yellow' : 'green',
      explanation: 'Variación de registros vs. inicio de semana (estimado).',
      suggestedAction: week > 50 ? 'Capacidad bajo presión — revisar cupos.' : 'Ritmo estable.',
      actionTo: '/admin/analytics',
      actionLabel: 'Ver analytics',
      severity: week > 50 ? 'warning' : 'success',
      updatedAt: now,
    },
    {
      id: 'no-predictions',
      label: 'Sin predicciones',
      value: overview?.users_without_predictions ?? dashboard.users_without_predictions ?? 0,
      state: (overview?.users_without_predictions ?? 0) > registered * 0.4 ? 'yellow' : 'green',
      explanation: 'Usuarios registrados que nunca cargaron un pronóstico.',
      suggestedAction: 'Enviar notificación de bienvenida o recordatorio.',
      actionTo: '/admin/notifications',
      actionLabel: 'Notificar',
      severity: 'warning',
      updatedAt: now,
    },
  ]
}

export function buildCapacityMetrics(
  capacity: AdminBetaCapacity | null | undefined,
  overview: AdminBetaOverview | null | undefined,
  now = new Date().toISOString(),
): OperationalMetric[] {
  if (!capacity && !overview) return []

  const registered = capacity?.registered_users ?? overview?.registered_users ?? 0
  const max = overview?.max_users ?? MAX_BETA_USERS
  const pct = capacity?.capacity_percent ?? overview?.capacity_percent ?? Math.round((registered / max) * 1000) / 10
  const remaining = overview?.available_slots ?? Math.max(0, max - registered)
  const dailyRate = Math.max(0.5, (capacity?.new_users_7d ?? 0) / 7)
  const daysToFull = remaining > 0 ? Math.ceil(remaining / dailyRate) : 0

  const state: HealthStatus = pct >= 95 ? 'red' : pct >= 80 ? 'yellow' : 'green'

  return [
    {
      id: 'capacity-occupancy',
      label: 'Ocupación actual',
      value: `${registered} / ${max}`,
      state,
      explanation: `${pct}% del cupo beta utilizado.`,
      suggestedAction:
        pct >= 90
          ? 'Capacidad crítica. Considerá ampliar beta o cerrar registros.'
          : 'Capacidad bajo control.',
      actionTo: '/admin/beta-capacity',
      actionLabel: 'Ampliar beta',
      severity: pct >= 95 ? 'critical' : pct >= 80 ? 'warning' : 'success',
      updatedAt: now,
      trend: `${pct}%`,
    },
    {
      id: 'capacity-remaining',
      label: 'Capacidad restante',
      value: remaining,
      state: remaining <= 20 ? 'red' : remaining <= 50 ? 'yellow' : 'green',
      explanation: 'Cupos libres antes del límite operativo.',
      suggestedAction: remaining <= 30 ? 'Cerrar invitaciones o ampliar cupo.' : 'Margen aceptable.',
      severity: remaining <= 20 ? 'critical' : 'info',
      updatedAt: now,
    },
    {
      id: 'capacity-velocity',
      label: 'Velocidad crecimiento',
      value: `${Math.round(dailyRate * 10) / 10}/día`,
      state: dailyRate > 15 ? 'yellow' : 'green',
      explanation: 'Promedio de nuevos usuarios por día (últimos 7 días).',
      suggestedAction: 'Proyectar agotamiento de cupos.',
      severity: 'info',
      updatedAt: now,
    },
    {
      id: 'capacity-projection',
      label: 'Proyección agotamiento',
      value: daysToFull > 0 ? `${daysToFull} días` : 'Límite alcanzado',
      state: daysToFull <= 5 ? 'red' : daysToFull <= 14 ? 'yellow' : 'green',
      explanation:
        daysToFull > 0
          ? `A este ritmo el cupo se agotaría en ~${daysToFull} días.`
          : 'El cupo beta está en o cerca del límite.',
      suggestedAction:
        daysToFull <= 7 ? 'Acción inmediata: ampliar beta o pausar registros.' : 'Planificar con anticipación.',
      actionTo: '/admin/beta-capacity',
      actionLabel: 'Gestionar cupo',
      severity: daysToFull <= 5 ? 'critical' : daysToFull <= 14 ? 'warning' : 'info',
      updatedAt: now,
    },
  ]
}

export function buildOperationalAlerts(input: {
  dashboard?: AdminDashboard | null
  capacity?: AdminBetaCapacity | null
  overview?: AdminBetaOverview | null
  health?: AdminSystemHealth | null
  scoring?: AdminScoringCenter | null
}): OperationalAlert[] {
  const alerts: OperationalAlert[] = []
  const now = new Date().toISOString()

  const capacity = input.capacity
  const overview = input.overview
  const pct = capacity?.capacity_percent ?? overview?.capacity_percent ?? 0

  if (pct >= 80) {
    alerts.push({
      id: 'cap-80',
      severity: pct >= 95 ? 'critical' : 'warning',
      title: `Capacidad al ${pct}%`,
      description: `${capacity?.registered_users ?? overview?.registered_users ?? 0} usuarios registrados.`,
      cause: 'Alta velocidad de registros o cupo beta reducido.',
      impact: 'Las invitaciones podrían agotarse pronto.',
      suggestedAction: 'Ampliar cupos o cerrar registros temporalmente.',
      actionTo: '/admin/beta-capacity',
      actionLabel: 'Gestionar capacidad',
      timestamp: now,
    })
  }

  const lastSync = capacity?.last_sync ?? input.dashboard?.last_sync
  const syncMins = minutesSince(lastSync?.finished_at ?? lastSync?.started_at)
  const syncStatus = (lastSync?.status ?? '').toLowerCase()
  const syncOk = SYNC_OK.has(syncStatus)

  if (!lastSync || (syncMins != null && syncMins > 30) || !syncOk) {
    alerts.push({
      id: 'sync-stale',
      severity: syncMins != null && syncMins > 60 ? 'critical' : 'warning',
      title: lastSync
        ? `API Football sin sync reciente (${formatRelativeMinutes(syncMins)})`
        : 'API Football sin sincronizar',
      description: lastSync
        ? `Último sync: ${lastSync.sync_type ?? '—'} · estado ${lastSync.status ?? '—'}`
        : 'No hay registros en data_sync_logs.',
      cause: 'GitHub Actions retrasado, fallo de API o límite de requests.',
      impact: 'Resultados y fixture pueden estar desactualizados.',
      suggestedAction: 'Ejecutar sincronización inmediata desde GitHub Actions.',
      actionTo: '/admin/health',
      actionLabel: 'Ver salud',
      timestamp: lastSync?.finished_at ?? lastSync?.started_at ?? now,
    })
  }

  const orphans = input.scoring?.orphan_scored?.count ?? input.health?.orphan_scored?.count ?? 0
  if (orphans > 0) {
    alerts.push({
      id: 'orphan-scored',
      severity: 'critical',
      title: `${orphans} predicciones huérfanas`,
      description: 'Predicciones puntuadas en partidos no finalizados.',
      cause: 'Scoring prematuro o cambio de estado del partido.',
      impact: 'Ranking y puntajes pueden ser incorrectos.',
      suggestedAction: 'Validar integridad y re-score en Centro de Scoring.',
      actionTo: '/admin/scoring',
      actionLabel: 'Ir a scoring',
      timestamp: now,
    })
  }

  const pending = input.scoring?.summary.pending_scoring ?? 0
  if (pending > 0) {
    alerts.push({
      id: 'pending-scoring',
      severity: 'warning',
      title: `${pending} partidos pendientes de puntuar`,
      description: 'Partidos finalizados sin scoring aplicado.',
      cause: 'Scoring automático pendiente o partido recién finalizado.',
      impact: 'Usuarios no ven puntos actualizados.',
      suggestedAction: 'Puntuar partidos pendientes desde Scoring Center.',
      actionTo: '/admin/scoring',
      actionLabel: 'Puntuar ahora',
      timestamp: now,
    })
  }

  const review = input.dashboard?.users_review_required ?? 0
  if (review > 0) {
    alerts.push({
      id: 'dni-review',
      severity: 'warning',
      title: `${review} usuarios requieren revisión DNI`,
      description: 'Registros con discrepancia en padrón de referencia.',
      cause: 'DNI no coincide con legajo autorizado.',
      impact: 'Riesgo de cuentas fraudulentas o errores de datos.',
      suggestedAction: 'Revisar y aprobar/rechazar en Usuarios.',
      actionTo: '/admin/users',
      actionLabel: 'Revisar usuarios',
      timestamp: now,
    })
  }

  if ((capacity?.recent_sync_errors_24h ?? 0) > 0) {
    alerts.push({
      id: 'sync-errors',
      severity: 'warning',
      title: `${capacity!.recent_sync_errors_24h} errores de sync en 24 h`,
      description: 'Fallos registrados en data_sync_logs.',
      cause: 'API Football, timeout o datos inválidos.',
      impact: 'Datos parcialmente desactualizados.',
      suggestedAction: 'Revisar logs y re-ejecutar sync.',
      actionTo: '/admin/health',
      actionLabel: 'Diagnóstico',
      timestamp: now,
    })
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'all-clear',
      severity: 'success',
      title: 'Operaciones estables',
      description: 'No hay alertas críticas ni warnings activos.',
      cause: 'Todos los indicadores dentro de umbrales.',
      impact: 'Ninguno.',
      suggestedAction: 'Continuar monitoreo rutinario.',
      timestamp: now,
    })
  }

  return alerts.sort((a, b) => {
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 }
    return order[a.severity] - order[b.severity]
  })
}

export function buildOperationalRecommendations(
  alerts: OperationalAlert[],
  capacity?: AdminBetaCapacity | null,
): OperationalRecommendation[] {
  const recs: OperationalRecommendation[] = []

  const pct = capacity?.capacity_percent ?? 0
  if (pct >= 85) {
    recs.push({
      id: 'rec-capacity',
      priority: pct >= 92 ? 'high' : 'medium',
      message: `Capacidad al ${pct}%. Recomendamos ampliar beta o cerrar invitaciones.`,
      actionTo: '/admin/beta-capacity',
      actionLabel: 'Gestionar cupo',
    })
  }

  const week = capacity?.new_users_7d ?? 0
  if (week > 30) {
    recs.push({
      id: 'rec-growth',
      priority: 'medium',
      message: `Usuarios crecieron con ${week} altas esta semana. Monitorear infraestructura.`,
      actionTo: '/admin/analytics',
      actionLabel: 'Ver analytics',
    })
  }

  if ((capacity?.recent_sync_errors_24h ?? 0) >= 2) {
    recs.push({
      id: 'rec-sync',
      priority: 'high',
      message: 'Se detectaron fallos de sincronización. Revisar API Football.',
      actionTo: '/admin/health',
      actionLabel: 'Health Center',
    })
  }

  const inactive = (capacity?.registered_users ?? 0) - (capacity?.users_with_predictions ?? 0)
  if (inactive > 20) {
    recs.push({
      id: 'rec-inactive',
      priority: 'low',
      message: `Existen ${inactive} usuarios sin actividad de predicciones.`,
      actionTo: '/admin/notifications',
      actionLabel: 'Enviar campaña',
    })
  }

  if (alerts.some(a => a.id === 'orphan-scored')) {
    recs.push({
      id: 'rec-orphan',
      priority: 'high',
      message: 'Se detectaron predicciones anómalas (huérfanas). Validar integridad.',
      actionTo: '/admin/scoring',
      actionLabel: 'Validar scoring',
    })
  }

  return recs
}

const SERVICE_META: Record<string, { description: string; actionGreen: string; actionYellow: string; actionRed: string; actionTo?: string; actionLabel?: string }> = {
  supabase: {
    description: 'Base de datos y RPCs administrativos.',
    actionGreen: 'Ninguna — operativo.',
    actionYellow: 'Monitorear latencia.',
    actionRed: 'Revisar Supabase Dashboard y conectividad.',
    actionTo: '/admin/system',
  },
  realtime: {
    description: 'Canales en tiempo real del cliente.',
    actionGreen: 'Ninguna.',
    actionYellow: 'Verificar suscripciones.',
    actionRed: 'Revisar Realtime en Supabase.',
  },
  scheduler: {
    description: 'Sincronización automática vía GitHub Actions.',
    actionGreen: 'Ninguna.',
    actionYellow: 'Verificar último workflow en GitHub.',
    actionRed: 'Ejecutar sync manual inmediato.',
    actionTo: '/admin/beta-capacity',
    actionLabel: 'Ver sync',
  },
  leaderboard: {
    description: 'Ranking global de puntos.',
    actionGreen: 'Ninguna.',
    actionYellow: 'Recalcular si hay discrepancias.',
    actionRed: 'Ejecutar admin_recalculate_leaderboard.',
    actionTo: '/admin/scoring',
  },
  invitations: {
    description: 'Estado del registro de nuevos usuarios.',
    actionGreen: 'Registro abierto — normal.',
    actionYellow: 'Evaluar cerrar invitaciones.',
    actionRed: 'Cerrar registro para proteger cupo.',
    actionTo: '/admin/beta-capacity',
  },
  scoring_integrity: {
    description: 'Integridad de predicciones puntuadas.',
    actionGreen: 'Sin anomalías.',
    actionYellow: 'Revisar casos pendientes.',
    actionRed: 'Corregir huérfanas antes de continuar.',
    actionTo: '/admin/scoring',
  },
  scoring: {
    description: 'Motor de cálculo de puntos.',
    actionGreen: 'Scoring operativo.',
    actionYellow: 'Puntuar partidos pendientes.',
    actionRed: 'Intervención manual requerida.',
    actionTo: '/admin/scoring',
  },
  football_api: {
    description: 'Proveedor de datos deportivos (API Football).',
    actionGreen: 'Sync sin errores recientes.',
    actionYellow: 'Monitorear consumo de requests.',
    actionRed: 'Revisar API key y límites.',
    actionTo: '/admin/health',
  },
}

export function enrichHealthServices(health: AdminSystemHealth): EnrichedServiceHealth[] {
  return health.services.map(svc => {
    const meta = SERVICE_META[svc.id] ?? {
      description: svc.detail,
      actionGreen: 'Ninguna.',
      actionYellow: 'Monitorear.',
      actionRed: 'Investigar.',
    }
    const risk = riskFromStatus(svc.status)
    const action =
      svc.status === 'green' ? meta.actionGreen : svc.status === 'yellow' ? meta.actionYellow : meta.actionRed

    const mins = minutesSince(svc.last_run)
    const history24h = mins != null && mins < 1440 ? `Última actividad ${formatRelativeMinutes(mins)}` : 'Sin actividad 24h'
    const history7d = svc.last_run ? `Último evento: ${fmtDate(svc.last_run)}` : 'Sin historial 7d'

    return {
      id: svc.id,
      label: svc.label,
      status: svc.status,
      description: meta.description,
      lastRun: svc.last_run,
      responseMs: svc.response_ms,
      risk,
      suggestedAction: action,
      actionTo: meta.actionTo,
      actionLabel: meta.actionLabel,
      detail: svc.detail,
      lastError: svc.last_error,
      history24h,
      history7d,
    }
  })
}

export function overallStatusFromAlerts(alerts: OperationalAlert[]): HealthStatus {
  if (alerts.some(a => a.severity === 'critical')) return 'red'
  if (alerts.some(a => a.severity === 'warning')) return 'yellow'
  return 'green'
}
