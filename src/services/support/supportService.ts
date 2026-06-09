import { supabase } from '../../lib/supabase'
import type {
  CreateSupportTicketInput,
  SupportCategory,
  SupportPriority,
  SupportStatus,
  UpdateSupportTicketInput,
  UserSupportTicket,
} from '../../types/support'

type TicketRow = {
  id: string
  user_id: string
  category: SupportCategory
  subject: string
  message: string
  priority: SupportPriority
  status: SupportStatus
  admin_response: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  profiles?: { full_name: string | null; legajo: string | null } | null
}

function mapTicket(row: TicketRow): UserSupportTicket {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    subject: row.subject,
    message: row.message,
    priority: row.priority,
    status: row.status,
    adminResponse: row.admin_response,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    profile: row.profiles
      ? { fullName: row.profiles.full_name, legajo: row.profiles.legajo }
      : null,
  }
}

export async function fetchMySupportTickets(userId: string): Promise<UserSupportTicket[]> {
  const { data, error } = await supabase
    .from('user_support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(row => mapTicket(row as TicketRow))
}

export async function createSupportTicket(
  userId: string,
  input: CreateSupportTicketInput
): Promise<UserSupportTicket> {
  const { data, error } = await supabase
    .from('user_support_tickets')
    .insert({
      user_id: userId,
      category: input.category,
      subject: input.subject.trim(),
      message: input.message.trim(),
      priority: input.priority,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapTicket(data as TicketRow)
}

export async function fetchAdminSupportTickets(): Promise<UserSupportTicket[]> {
  const { data, error } = await supabase
    .from('user_support_tickets')
    .select('*, profiles(full_name, legajo)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data ?? []).map(row => mapTicket(row as TicketRow))
}

export async function updateSupportTicket(
  ticketId: string,
  input: UpdateSupportTicketInput
): Promise<void> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.status) {
    payload.status = input.status
    if (input.status === 'resolved') {
      payload.resolved_at = new Date().toISOString()
    }
  }

  if (input.adminResponse !== undefined) {
    payload.admin_response = input.adminResponse
  }

  const { error } = await supabase.from('user_support_tickets').update(payload).eq('id', ticketId)
  if (error) throw error
}

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  predicciones: 'Predicciones',
  ranking: 'Ranking',
  puntos: 'Puntos',
  login: 'Login / acceso',
  perfil: 'Perfil',
  pagos: 'Pagos',
  otro: 'Otro',
}

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  open: 'Abierta',
  in_review: 'En revisión',
  resolved: 'Resuelta',
}

export const SUPPORT_PRIORITY_LABELS: Record<SupportPriority, string> = {
  normal: 'Normal',
  alta: 'Alta',
}
