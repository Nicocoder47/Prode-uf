import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSupportTicket,
  fetchAdminSupportTickets,
  fetchMySupportTickets,
  updateSupportTicket,
} from '../services/support/supportService'
import type { CreateSupportTicketInput, UpdateSupportTicketInput } from '../types/support'

export const supportKeys = {
  mine: (userId: string) => ['support', 'mine', userId] as const,
  admin: () => ['support', 'admin'] as const,
}

export function useMySupportTickets(userId: string | undefined) {
  return useQuery({
    queryKey: supportKeys.mine(userId ?? ''),
    queryFn: () => fetchMySupportTickets(userId!),
    enabled: Boolean(userId),
    staleTime: 20_000,
  })
}

export function useCreateSupportTicket(userId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateSupportTicketInput) => {
      if (!userId) throw new Error('Usuario no autenticado')
      return createSupportTicket(userId, input)
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: supportKeys.mine(userId) })
    },
  })
}

export function useAdminSupportTickets(enabled = true) {
  return useQuery({
    queryKey: supportKeys.admin(),
    queryFn: fetchAdminSupportTickets,
    enabled,
    staleTime: 15_000,
  })
}

export function useUpdateSupportTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ ticketId, input }: { ticketId: string; input: UpdateSupportTicketInput }) =>
      updateSupportTicket(ticketId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] })
    },
  })
}
