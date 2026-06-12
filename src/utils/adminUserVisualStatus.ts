import type { AdminUserRow, ReviewStatus } from '../types/admin'

export type AdminUserVisualTone = 'green' | 'red' | 'yellow' | 'gray'

const TONE_ROW_CLASS: Record<AdminUserVisualTone, string> = {
  green: 'admin-user-tone--green',
  red: 'admin-user-tone--red',
  yellow: 'admin-user-tone--yellow',
  gray: 'admin-user-tone--gray',
}

export function getAdminUserVisualTone(user: AdminUserRow): AdminUserVisualTone {
  const status = user.review_status ?? 'pending'
  const inactive = !user.last_login_at && (user.predictions_count ?? 0) === 0 && !user.active_last_7d

  if (inactive && (status === 'pending' || !user.review_status)) return 'gray'
  if (status === 'verified' || status === 'manually_approved') return 'green'
  if (status === 'review_required' || status === 'rejected') return 'red'
  return 'yellow'
}

export function adminUserToneRowClass(user: AdminUserRow): string {
  return TONE_ROW_CLASS[getAdminUserVisualTone(user)]
}

export function getVerificationListLabel(user: AdminUserRow): string {
  const status = user.review_status ?? 'pending'
  const reason = (user.review_reason ?? '').toLowerCase()

  if (status === 'verified' || status === 'manually_approved') return 'Coincide'
  if (status === 'review_required') {
    if (reason.includes('no encontrado') || reason.includes('not found')) return 'No encontrado'
    if (user.match_label?.toLowerCase().includes('no encontrado')) return 'No encontrado'
    return 'No coincide'
  }
  if (status === 'rejected') return 'Rechazado'
  return 'Pendiente'
}

export function getAccountStateLabel(user: AdminUserRow): string {
  if (user.deleted_at) return 'Inactivo'
  if (user.is_blocked || !user.is_active) return 'Inactivo'
  if (!user.last_login_at || user.never_logged_in) return 'Sin login'
  return 'Activo'
}

export function getActivityStateLabel(user: AdminUserRow): string {
  if (!user.last_login_at && (user.predictions_count ?? 0) === 0) return 'Sin actividad'
  if (user.active_last_7d) return 'Activo últimos 7 días'
  if (user.last_login_at) return 'Con login previo'
  return 'Sin actividad'
}

export function verificationResultLabel(status?: ReviewStatus): string {
  switch (status ?? 'pending') {
    case 'verified':
    case 'manually_approved':
      return 'Coincide con padrón'
    case 'review_required':
      return 'No coincide o no encontrado'
    case 'rejected':
      return 'Rechazado por admin'
    default:
      return 'Pendiente de revisión'
  }
}
