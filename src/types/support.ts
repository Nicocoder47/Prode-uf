export type SupportCategory =
  | 'predicciones'
  | 'ranking'
  | 'puntos'
  | 'login'
  | 'perfil'
  | 'pagos'
  | 'otro'

export type SupportPriority = 'normal' | 'alta'

export type SupportStatus = 'open' | 'in_review' | 'resolved'

export type UserSupportTicket = {
  id: string
  userId: string
  category: SupportCategory
  subject: string
  message: string
  priority: SupportPriority
  status: SupportStatus
  adminResponse: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  profile?: {
    fullName?: string | null
    legajo?: string | null
  } | null
}

export type CreateSupportTicketInput = {
  category: SupportCategory
  subject: string
  message: string
  priority: SupportPriority
}

export type UpdateSupportTicketInput = {
  status?: SupportStatus
  adminResponse?: string | null
}
