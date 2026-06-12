import { useMemo, useState } from 'react'
import { LifeBuoy, Send } from 'lucide-react'
import { MOTION } from '../../constants/design'
import { AdaptiveButton, AdaptiveSection } from '../../utils/adaptiveMotion'
import { useCreateSupportTicket, useMySupportTickets } from '../../hooks/useSupportTickets'
import {
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
} from '../../services/support/supportService'
import type { CreateSupportTicketInput, SupportCategory, SupportPriority } from '../../types/support'

const CATEGORIES = Object.keys(SUPPORT_CATEGORY_LABELS) as SupportCategory[]

type ProfileSupportSectionProps = {
  userId: string | undefined
}

export function ProfileSupportSection({ userId }: ProfileSupportSectionProps) {
  const { data: tickets = [], isLoading, error } = useMySupportTickets(userId)
  const createTicket = useCreateSupportTicket(userId)

  const [category, setCategory] = useState<SupportCategory>('predicciones')
  const [priority, setPriority] = useState<SupportPriority>('normal')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const openCount = useMemo(
    () => tickets.filter(t => t.status !== 'resolved').length,
    [tickets]
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    const input: CreateSupportTicketInput = {
      category,
      subject: subject.trim(),
      message: message.trim(),
      priority,
    }

    if (!input.subject || !input.message) {
      setFormError('Completá asunto y mensaje.')
      return
    }

    try {
      await createTicket.mutateAsync(input)
      setSubject('')
      setMessage('')
      setPriority('normal')
      setFormSuccess('Consulta enviada. Te responderemos pronto.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo enviar la consulta.')
    }
  }

  return (
    <AdaptiveSection motionProps={MOTION.enter} className="wc26-profile-section wc26-deferred-section">
      <div className="wc26-profile-section__header">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-[#F8B91E]" />
          <div>
            <p className="wc26-profile-section__kicker">Ayuda</p>
            <h2 className="wc26-profile-section__title">Consultas y problemas</h2>
          </div>
        </div>
        {openCount > 0 ? (
          <span className="wc26-profile-support-badge">{openCount} abierta{openCount === 1 ? '' : 's'}</span>
        ) : null}
      </div>

      <form className="wc26-profile-support-form" onSubmit={handleSubmit}>
        <div className="wc26-profile-support-form__grid">
          <label className="wc26-profile-support-field">
            <span>Categoría</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as SupportCategory)}
              className="wc26-profile-support-input"
            >
              {CATEGORIES.map(value => (
                <option key={value} value={value}>
                  {SUPPORT_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="wc26-profile-support-field">
            <span>Prioridad</span>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as SupportPriority)}
              className="wc26-profile-support-input"
            >
              <option value="normal">{SUPPORT_PRIORITY_LABELS.normal}</option>
              <option value="alta">{SUPPORT_PRIORITY_LABELS.alta}</option>
            </select>
          </label>
        </div>

        <label className="wc26-profile-support-field">
          <span>Asunto</span>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="wc26-profile-support-input"
            placeholder="Ej: No veo mis puntos del último partido"
            maxLength={120}
          />
        </label>

        <label className="wc26-profile-support-field">
          <span>Mensaje</span>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="wc26-profile-support-input wc26-profile-support-input--area"
            rows={4}
            placeholder="Contanos qué pasó con el mayor detalle posible."
            maxLength={2000}
          />
        </label>

        {formError ? <p className="wc26-profile-support-error">{formError}</p> : null}
        {formSuccess ? <p className="wc26-profile-support-success">{formSuccess}</p> : null}

        <AdaptiveButton
          type="submit"
          disabled={createTicket.isPending}
          className="wc26-profile-cta"
          motionProps={MOTION.tap}
        >
          <Send className="h-4 w-4" />
          {createTicket.isPending ? 'Enviando…' : 'Enviar consulta'}
        </AdaptiveButton>
      </form>

      <div className="wc26-profile-support-history">
        <p className="wc26-profile-support-history__title">Mis consultas</p>

        {isLoading ? (
          <p className="wc26-profile-empty">Cargando consultas…</p>
        ) : error ? (
          <p className="wc26-profile-support-error">
            {error instanceof Error ? error.message : 'No se pudieron cargar las consultas.'}
          </p>
        ) : tickets.length === 0 ? (
          <p className="wc26-profile-empty">Todavía no enviaste consultas.</p>
        ) : (
          <div className="wc26-profile-support-list">
            {tickets.map(ticket => (
              <article key={ticket.id} className="wc26-profile-support-item">
                <div className="wc26-profile-support-item__top">
                  <span className="wc26-profile-support-item__category">
                    {SUPPORT_CATEGORY_LABELS[ticket.category]}
                  </span>
                  <span className={`wc26-profile-support-item__status wc26-profile-support-item__status--${ticket.status}`}>
                    {SUPPORT_STATUS_LABELS[ticket.status]}
                  </span>
                </div>
                <h3 className="wc26-profile-support-item__subject">{ticket.subject}</h3>
                <p className="wc26-profile-support-item__message">{ticket.message}</p>
                <p className="wc26-profile-support-item__meta">
                  {SUPPORT_PRIORITY_LABELS[ticket.priority]} ·{' '}
                  {new Date(ticket.createdAt).toLocaleString('es-AR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </p>
                {ticket.adminResponse ? (
                  <div className="wc26-profile-support-item__response">
                    <p className="wc26-profile-support-item__response-label">Respuesta del equipo</p>
                    <p>{ticket.adminResponse}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </AdaptiveSection>
  )
}
