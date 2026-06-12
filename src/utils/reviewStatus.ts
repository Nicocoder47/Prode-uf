import type { ReviewStatus } from '../types/admin.ts'

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pendiente',
  verified: 'Verificado',
  review_required: 'Revisar',
  manually_approved: 'Aprobado manual',
  rejected: 'Rechazado',
}

export const REVIEW_STATUS_CLASS: Record<ReviewStatus, string> = {
  pending: 'admin-review-badge admin-review-badge--pending',
  verified: 'admin-review-badge admin-review-badge--verified',
  review_required: 'admin-review-badge admin-review-badge--review',
  manually_approved: 'admin-review-badge admin-review-badge--approved',
  rejected: 'admin-review-badge admin-review-badge--rejected',
}

export function reviewRowClass(status?: ReviewStatus): string {
  if (status === 'review_required') return 'admin-user-row--review'
  if (status === 'verified') return 'admin-user-row--verified'
  if (status === 'rejected') return 'admin-user-row--rejected'
  return ''
}
