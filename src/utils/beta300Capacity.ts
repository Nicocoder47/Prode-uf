import {
  MAX_BETA_USERS,
  WARN_USERS,
  CRITICAL_USERS,
  HARD_STOP_USERS,
  WARN_CONCURRENT_USERS,
  CRITICAL_CONCURRENT_USERS,
} from '../config/betaMode'

export type Beta300Status = 'green' | 'yellow' | 'red' | 'exceeded'
export type Beta300TechnicalAction =
  | 'seguir_gratis'
  | 'monitorear'
  | 'cerrar_invitaciones'
  | 'migrar'

export type DeviceHealthSummary = {
  reports_24h: number
  errors_24h: number
  error_rate: number
  errors_by_device: Record<string, number>
  errors_by_browser: Record<string, number>
  slow_routes: { route: string; avg_ms: number }[]
  top_error_routes: { route: string; count: number }[]
  mobile_error_share_pct: number
}

export type Beta300Input = {
  registeredUsers: number
  activeUsers24h?: number
  activeUsers7d?: number
  estimatedConcurrent?: number
  readP95Ms?: number | null
  saveP95Ms?: number | null
  syncErrors24h?: number
  authErrors429?: number
  deviceHealth?: DeviceHealthSummary | null
}

export type Beta300Evaluation = {
  status: Beta300Status
  capacityPercent: number
  message: string
  technicalAction: Beta300TechnicalAction
  migrationNeeded: boolean
  reasons: string[]
  estimatedConcurrent: number
}

export function estimateConcurrentUsers(
  registeredUsers: number,
  activeUsers7d: number,
  activeUsers24h: number,
): number {
  const from24h = Math.round(activeUsers24h * 0.4)
  const from7d = Math.round(activeUsers7d * 0.35)
  const fromTotal = Math.round(registeredUsers * 0.12)
  return Math.max(from24h, from7d, fromTotal, 5)
}

export function capacityPercent(registeredUsers: number): number {
  return Math.min(100, Math.round((registeredUsers / MAX_BETA_USERS) * 1000) / 10)
}

export function evaluateBeta300(input: Beta300Input): Beta300Evaluation {
  const {
    registeredUsers,
    activeUsers24h = 0,
    activeUsers7d = 0,
    readP95Ms = null,
    saveP95Ms = null,
    syncErrors24h = 0,
    authErrors429 = 0,
    deviceHealth = null,
  } = input

  const estimatedConcurrent =
    input.estimatedConcurrent ??
    estimateConcurrentUsers(registeredUsers, activeUsers7d, activeUsers24h)

  const pct = capacityPercent(registeredUsers)
  const reasons: string[] = []

  let status: Beta300Status = 'green'
  let message = 'Beta saludable. Puede seguir gratis.'
  let technicalAction: Beta300TechnicalAction = 'seguir_gratis'
  let migrationNeeded = false

  if (registeredUsers > HARD_STOP_USERS) {
    status = 'exceeded'
    message = 'Excede beta 300. Desactivar nuevas invitaciones y migrar.'
    technicalAction = 'migrar'
    migrationNeeded = true
    reasons.push(`Usuarios (${registeredUsers}) superan el límite de ${MAX_BETA_USERS}`)
  } else if (registeredUsers >= CRITICAL_USERS) {
    status = 'red'
    message = 'Crítico: no abrir más invitaciones. Preparar migración.'
    technicalAction = 'cerrar_invitaciones'
    migrationNeeded = true
    reasons.push(`Usuarios (${registeredUsers}) en zona crítica ≥ ${CRITICAL_USERS}`)
  } else if (registeredUsers >= WARN_USERS) {
    status = 'yellow'
    message = 'Atención: acercándose al límite de beta 300.'
    technicalAction = 'monitorear'
    reasons.push(`Usuarios (${registeredUsers}) ≥ umbral de alerta ${WARN_USERS}`)
  }

  if (estimatedConcurrent >= CRITICAL_CONCURRENT_USERS) {
    if (status === 'green') status = 'yellow'
    technicalAction = technicalAction === 'seguir_gratis' ? 'monitorear' : technicalAction
    reasons.push(`Concurrentes estimados (${estimatedConcurrent}) ≥ ${CRITICAL_CONCURRENT_USERS}`)
  } else if (estimatedConcurrent >= WARN_CONCURRENT_USERS && status === 'green') {
    technicalAction = 'monitorear'
    reasons.push(`Concurrentes estimados (${estimatedConcurrent}) ≥ ${WARN_CONCURRENT_USERS}`)
  }

  if (syncErrors24h > 0) {
    if (status === 'green') status = 'yellow'
    technicalAction = technicalAction === 'seguir_gratis' ? 'monitorear' : technicalAction
    reasons.push(`Errores sync 24h: ${syncErrors24h}`)
  }

  if (authErrors429 > 0) {
    status = status === 'exceeded' ? 'exceeded' : 'red'
    migrationNeeded = true
    technicalAction = 'migrar'
    reasons.push(`Errores Auth 429: ${authErrors429}`)
  }

  if (readP95Ms != null && readP95Ms > 4000) {
    if (status === 'green') status = 'yellow'
    technicalAction = technicalAction === 'seguir_gratis' ? 'monitorear' : technicalAction
    reasons.push(`Lectura p95 ~${Math.round(readP95Ms)}ms`)
  }

  if (saveP95Ms != null && saveP95Ms > 3000) {
    if (status !== 'exceeded') status = 'red'
    migrationNeeded = true
    technicalAction = 'cerrar_invitaciones'
    reasons.push(`save_prediction p95 ~${Math.round(saveP95Ms)}ms`)
  }

  if (deviceHealth && deviceHealth.error_rate > 5) {
    if (status === 'green') status = 'yellow'
    reasons.push(`Tasa de errores dispositivo ${deviceHealth.error_rate}%`)
  }

  if (deviceHealth && deviceHealth.mobile_error_share_pct > 60) {
    reasons.push(`Mobile concentra ${deviceHealth.mobile_error_share_pct}% de errores`)
  }

  if (reasons.length === 0) {
    reasons.push(`Capacidad ${pct}% — dentro de beta ${MAX_BETA_USERS}`)
  }

  return {
    status,
    capacityPercent: pct,
    message,
    technicalAction,
    migrationNeeded,
    reasons,
    estimatedConcurrent,
  }
}

export const BETA300_STATUS_LABELS: Record<Beta300Status, string> = {
  green: 'VERDE',
  yellow: 'AMARILLO',
  red: 'ROJO',
  exceeded: 'EXCEDIDO',
}

export const BETA300_ACTION_LABELS: Record<Beta300TechnicalAction, string> = {
  seguir_gratis: 'Seguir gratis',
  monitorear: 'Monitorear de cerca',
  cerrar_invitaciones: 'Cerrar nuevas invitaciones',
  migrar: 'Migrar a Supabase Pro + worker externo',
}
