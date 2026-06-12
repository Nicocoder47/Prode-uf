import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, Save } from 'lucide-react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { useAppToast } from '../../components/ui/ToastProvider.tsx'
import {
  buildScoringTipMessage,
  SCORING_DISPLAY_CARD_KEYS,
} from '../../config/scoringDisplay.ts'
import {
  DEFAULT_TICKER_CONTENT,
  TICKER_CONTENT_KEYS,
} from '../../config/tickerContent.ts'
import { useAdminCards, useInvalidateAdmin } from '../../hooks/useAdminQueries.ts'
import { scoringDisplayKeys } from '../../hooks/useScoringDisplayConfig.ts'
import { adminUpdateCard } from '../../services/admin/adminService.ts'
import type { AdminCard } from '../../types/admin.ts'

function findCard(cards: AdminCard[], key: string) {
  return cards.find(card => card.key === key)
}

export default function AdminTickerContentPage() {
  const { data: cards = [], isLoading, refetch } = useAdminCards()
  const { invalidateCards } = useInvalidateAdmin()
  const queryClient = useQueryClient()
  const { showToast } = useAppToast()

  const welcomeCard = findCard(cards, TICKER_CONTENT_KEYS.welcome)
  const tipTitleCard = findCard(cards, TICKER_CONTENT_KEYS.tipTitle)
  const tipMessageCard = findCard(cards, TICKER_CONTENT_KEYS.tipMessage)
  const importantCard = findCard(cards, TICKER_CONTENT_KEYS.important)
  const exactCard = findCard(cards, SCORING_DISPLAY_CARD_KEYS.exactPts)
  const resultCard = findCard(cards, SCORING_DISPLAY_CARD_KEYS.resultPts)

  const [welcomeTitle, setWelcomeTitle] = useState<string>(DEFAULT_TICKER_CONTENT.welcomeTitle)
  const [welcomeMessage, setWelcomeMessage] = useState<string>(DEFAULT_TICKER_CONTENT.welcomeMessage)
  const [tipTitle, setTipTitle] = useState<string>(DEFAULT_TICKER_CONTENT.tipTitle)
  const [tipMessage, setTipMessage] = useState('')
  const [importantTitle, setImportantTitle] = useState<string>(DEFAULT_TICKER_CONTENT.importantTitle)
  const [importantMessage, setImportantMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!welcomeCard && !tipTitleCard && !tipMessageCard && !importantCard) return
    setWelcomeTitle(welcomeCard?.title?.trim() || DEFAULT_TICKER_CONTENT.welcomeTitle)
    setWelcomeMessage(welcomeCard?.value?.trim() || DEFAULT_TICKER_CONTENT.welcomeMessage)
    setTipTitle(tipTitleCard?.value?.trim() || DEFAULT_TICKER_CONTENT.tipTitle)
    setTipMessage(tipMessageCard?.value ?? '')
    setImportantTitle(importantCard?.title?.trim() || DEFAULT_TICKER_CONTENT.importantTitle)
    setImportantMessage(importantCard?.value === '—' ? '' : (importantCard?.value ?? ''))
  }, [welcomeCard, tipTitleCard, tipMessageCard, importantCard])

  const previewTipMessage = useMemo(() => {
    const exact = Number.parseInt(exactCard?.value ?? '5', 10)
    const result = Number.parseInt(resultCard?.value ?? '3', 10)
    return buildScoringTipMessage(
      Number.isFinite(exact) ? exact : 5,
      Number.isFinite(result) ? result : 3,
      tipMessage,
    )
  }, [exactCard, resultCard, tipMessage])

  const previewItems = useMemo(
    () => [
      { title: welcomeTitle, message: welcomeMessage },
      { title: tipTitle, message: previewTipMessage },
      ...(importantMessage.trim()
        ? [{ title: importantTitle, message: importantMessage.trim() }]
        : []),
    ],
    [welcomeTitle, welcomeMessage, tipTitle, previewTipMessage, importantTitle, importantMessage],
  )

  async function saveCard(card: AdminCard | undefined, patch: Partial<AdminCard>) {
    if (!card) return
    await adminUpdateCard({
      key: card.key,
      title: patch.title ?? card.title,
      value: patch.value ?? card.value ?? undefined,
      subtitle: card.subtitle ?? undefined,
      description: card.description ?? undefined,
      icon: card.icon ?? undefined,
      status: card.status,
      orderIndex: card.order_index,
      isActive: card.is_active,
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!welcomeCard || !tipTitleCard || !tipMessageCard) {
      setError('Faltan cards de configuración. Ejecutá las migraciones SQL (npm run db:push:cloud).')
      return
    }

    if (!welcomeTitle.trim() || !welcomeMessage.trim() || !tipTitle.trim()) {
      setError('Completá título y mensaje de bienvenida y del tip.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const saves = [
        saveCard(welcomeCard, { title: welcomeTitle.trim(), value: welcomeMessage.trim() }),
        saveCard(tipTitleCard, { value: tipTitle.trim() }),
        saveCard(tipMessageCard, { value: tipMessage.trim() }),
      ]

      if (importantCard) {
        saves.push(
          saveCard(importantCard, {
            title: importantTitle.trim() || DEFAULT_TICKER_CONTENT.importantTitle,
            value: importantMessage.trim() || '—',
          }),
        )
      }

      await Promise.all(saves)
      invalidateCards()
      await queryClient.invalidateQueries({ queryKey: scoringDisplayKeys.all })
      await refetch()
      showToast('Textos del ticker actualizados')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  const missingMigration = !isLoading && (!welcomeCard || !tipTitleCard || !tipMessageCard)

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-200/80">Contenido</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Textos del ticker</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Editá los mensajes que rotan en la barra superior del home. Los cambios se ven al instante en la app.
        </p>
      </div>

      {missingMigration && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Ejecutá las migraciones de ticker (<code className="text-amber-200">ticker_content_settings</code>) para
          habilitar esta sección.
        </div>
      )}

      <section className="admin-ticker-panel">
        <div className="admin-ticker-panel__header">
          <p className="admin-ticker-panel__eyebrow">Editor en vivo</p>
          <h3 className="admin-ticker-panel__title">Barra de notificaciones</h3>
        </div>

        <div className="admin-ticker-panel__preview">
          <div className="wc26-notification-ticker admin-ticker-panel__ticker">
            <div className="wc26-notification-ticker__inner">
              <span className="wc26-notification-ticker__badge" aria-hidden>
                <Bell className="h-4 w-4" />
              </span>
              <div className="wc26-notification-ticker__viewport">
                <p className="wc26-notification-ticker__preview">
                  {previewItems.map((item, index) => (
                    <span key={`${item.title}-${index}`}>
                      {index > 0 ? <span className="opacity-40"> · </span> : null}
                      <strong>{item.title}</strong>
                      <span className="opacity-80"> · {item.message}</span>
                    </span>
                  ))}
                </p>
              </div>
              <span className="wc26-notification-ticker__more" aria-hidden>
                +
              </span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <p className="admin-ticker-panel__loading">Cargando…</p>
        ) : (
          <form className="admin-ticker-panel__form" onSubmit={handleSave}>
            <fieldset className="admin-ticker-panel__block">
              <legend className="admin-ticker-panel__legend">Mensaje de bienvenida</legend>
              <label className="admin-ticker-panel__field">
                <span>Título</span>
                <input
                  type="text"
                  required
                  maxLength={48}
                  className="admin-ticker-panel__input"
                  value={welcomeTitle}
                  onChange={e => setWelcomeTitle(e.target.value)}
                />
              </label>
              <label className="admin-ticker-panel__field">
                <span>Mensaje</span>
                <textarea
                  rows={2}
                  required
                  maxLength={160}
                  className="admin-ticker-panel__textarea"
                  value={welcomeMessage}
                  onChange={e => setWelcomeMessage(e.target.value)}
                />
              </label>
            </fieldset>

            <fieldset className="admin-ticker-panel__block">
              <legend className="admin-ticker-panel__legend">Tip de puntos</legend>
              <label className="admin-ticker-panel__field">
                <span>Etiqueta</span>
                <input
                  type="text"
                  required
                  maxLength={24}
                  className="admin-ticker-panel__input"
                  value={tipTitle}
                  onChange={e => setTipTitle(e.target.value)}
                />
              </label>
              <label className="admin-ticker-panel__field">
                <span>Mensaje personalizado</span>
                <textarea
                  rows={3}
                  maxLength={200}
                  placeholder="Dejá vacío para el texto automático con los puntos configurados en «Puntos y ticker»"
                  className="admin-ticker-panel__textarea"
                  value={tipMessage}
                  onChange={e => setTipMessage(e.target.value)}
                />
              </label>
              {!tipMessage.trim() ? (
                <p className="admin-ticker-panel__hint">Vista previa automática: {previewTipMessage}</p>
              ) : null}
            </fieldset>

            <fieldset className="admin-ticker-panel__block">
              <legend className="admin-ticker-panel__legend">Aviso importante (opcional)</legend>
              <label className="admin-ticker-panel__field">
                <span>Título</span>
                <input
                  type="text"
                  maxLength={40}
                  className="admin-ticker-panel__input"
                  value={importantTitle}
                  onChange={e => setImportantTitle(e.target.value)}
                />
              </label>
              <label className="admin-ticker-panel__field">
                <span>Mensaje</span>
                <textarea
                  rows={2}
                  maxLength={160}
                  placeholder="Dejá vacío para ocultar este aviso"
                  className="admin-ticker-panel__textarea"
                  value={importantMessage}
                  onChange={e => setImportantMessage(e.target.value)}
                />
              </label>
            </fieldset>

            {error ? <p className="admin-ticker-panel__error">{error}</p> : null}

            <div className="admin-ticker-panel__actions">
              <PremiumButton type="submit" disabled={busy || missingMigration}>
                <Save className="h-4 w-4" />
                {busy ? 'Guardando…' : 'Guardar textos'}
              </PremiumButton>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
