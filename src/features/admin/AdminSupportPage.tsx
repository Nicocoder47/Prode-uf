import { useMemo, useState } from 'react'
import { LifeBuoy } from 'lucide-react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { useAppToast } from '../../components/ui/ToastProvider.tsx'
import { useAdminSupportTickets, useUpdateSupportTicket } from '../../hooks/useSupportTickets'
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
} from '../../services/support/supportService'
import type { SupportCategory, SupportPriority, SupportStatus, UserSupportTicket } from '../../types/support'

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function TicketRow({
  ticket,
  busy,
  onReview,
  onResolve,
  onRespond,
}: {
  ticket: UserSupportTicket
  busy: boolean
  onReview: () => void
  onResolve: (response: string) => void
  onRespond: (response: string) => void
}) {
  const [response, setResponse] = useState(ticket.adminResponse ?? '')

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300/80">
            {SUPPORT_CATEGORY_LABELS[ticket.category]} · {SUPPORT_PRIORITY_LABELS[ticket.priority]}
          </p>
          <h3 className="mt-1 text-base font-extrabold text-white">{ticket.subject}</h3>
          <p className="mt-1 text-sm text-white/70">
            {ticket.profile?.fullName ?? 'Usuario'} · Legajo {ticket.profile?.legajo ?? '—'}
          </p>
        </div>
        <span className={`admin-support-status admin-support-status--${ticket.status}`}>
          {SUPPORT_STATUS_LABELS[ticket.status]}
        </span>
      </div>

      <p className="mt-3 text-sm text-white/80">{ticket.message}</p>
      <p className="mt-2 text-xs text-white/45">{formatDate(ticket.createdAt)}</p>

      <textarea
        rows={3}
        value={response}
        onChange={e => setResponse(e.target.value)}
        className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
        placeholder="Respuesta para el usuario"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <PremiumButton
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => onRespond(response.trim())}
        >
          Responder
        </PremiumButton>
        {ticket.status === 'open' ? (
          <PremiumButton type="button" size="sm" variant="secondary" disabled={busy} onClick={onReview}>
            Marcar en revisión
          </PremiumButton>
        ) : null}
        {ticket.status !== 'resolved' ? (
          <PremiumButton
            type="button"
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => onResolve(response.trim())}
          >
            Resolver
          </PremiumButton>
        ) : null}
      </div>
    </article>
  )
}

export default function AdminSupportPage() {
  const { data: tickets = [], isLoading, refetch } = useAdminSupportTickets()
  const updateTicket = useUpdateSupportTicket()
  const { showToast } = useAppToast()
  const [statusFilter, setStatusFilter] = useState<SupportStatus | 'all'>('open')
  const [categoryFilter, setCategoryFilter] = useState<SupportCategory | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<SupportPriority | 'all'>('all')
  const [userFilter, setUserFilter] = useState('')

  const filtered = useMemo(() => {
    const query = userFilter.trim().toLowerCase()
    return tickets.filter(ticket => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false
      if (categoryFilter !== 'all' && ticket.category !== categoryFilter) return false
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false
      if (!query) return true
      const haystack = [
        ticket.profile?.fullName,
        ticket.profile?.legajo,
        ticket.subject,
        ticket.message,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [tickets, statusFilter, categoryFilter, priorityFilter, userFilter])

  const counts = useMemo(
    () => ({
      open: tickets.filter(t => t.status === 'open').length,
      inReview: tickets.filter(t => t.status === 'in_review').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
    }),
    [tickets]
  )

  async function mutateTicket(ticketId: string, input: Parameters<typeof updateTicket.mutateAsync>[0]['input']) {
    try {
      await updateTicket.mutateAsync({ ticketId, input })
      await refetch()
      showToast('Ticket actualizado')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al actualizar ticket')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">
            <LifeBuoy className="mr-1 inline h-4 w-4" />
            Soporte
          </p>
          <h2 className="text-xl font-extrabold text-white md:text-2xl">Consultas de usuarios</h2>
          <p className="mt-1 text-sm text-white/55">
            {counts.open} abiertos · {counts.inReview} en revisión · {counts.resolved} resueltos
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as SupportStatus | 'all')}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="open">Abiertos</option>
          <option value="in_review">En revisión</option>
          <option value="resolved">Resueltos</option>
          <option value="all">Todos los estados</option>
        </select>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as SupportCategory | 'all')}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="all">Todas las categorías</option>
          {(Object.keys(SUPPORT_CATEGORY_LABELS) as SupportCategory[]).map(category => (
            <option key={category} value={category}>
              {SUPPORT_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as SupportPriority | 'all')}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="all">Todas las prioridades</option>
          <option value="normal">{SUPPORT_PRIORITY_LABELS.normal}</option>
          <option value="alta">{SUPPORT_PRIORITY_LABELS.alta}</option>
        </select>

        <input
          value={userFilter}
          onChange={e => setUserFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          placeholder="Buscar por usuario o legajo"
        />
      </div>

      <PremiumCard title="Tickets">
        {isLoading ? (
          <p className="text-sm text-white/60">Cargando tickets…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-white/60">No hay tickets en este filtro.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map(ticket => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                busy={updateTicket.isPending}
                onReview={() => void mutateTicket(ticket.id, { status: 'in_review' })}
                onResolve={response =>
                  void mutateTicket(ticket.id, {
                    status: 'resolved',
                    adminResponse: response || null,
                  })
                }
                onRespond={response =>
                  void mutateTicket(ticket.id, {
                    adminResponse: response || null,
                    status: ticket.status === 'open' ? 'in_review' : ticket.status,
                  })
                }
              />
            ))}
          </div>
        )}
      </PremiumCard>
    </div>
  )
}
