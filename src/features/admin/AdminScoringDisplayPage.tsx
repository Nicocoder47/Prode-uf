import { useEffect, useMemo, useState } from 'react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { useAppToast } from '../../components/ui/ToastProvider.tsx'
import {
  buildScoringTipMessage,
  SCORING_DISPLAY_CARD_KEYS,
} from '../../config/scoringDisplay.ts'
import { useAdminCards, useInvalidateAdmin } from '../../hooks/useAdminQueries.ts'
import { scoringDisplayKeys } from '../../hooks/useScoringDisplayConfig.ts'
import { adminUpdateCard } from '../../services/admin/adminService.ts'
import type { AdminCard } from '../../types/admin.ts'
import { useQueryClient } from '@tanstack/react-query'

function findCard(cards: AdminCard[], key: string) {
  return cards.find(card => card.key === key)
}

export default function AdminScoringDisplayPage() {
  const { data: cards = [], isLoading, refetch } = useAdminCards()
  const { invalidateCards } = useInvalidateAdmin()
  const queryClient = useQueryClient()
  const { showToast } = useAppToast()

  const exactCard = findCard(cards, SCORING_DISPLAY_CARD_KEYS.exactPts)
  const resultCard = findCard(cards, SCORING_DISPLAY_CARD_KEYS.resultPts)
  const tipCard = findCard(cards, SCORING_DISPLAY_CARD_KEYS.tickerTip)

  const [exactPts, setExactPts] = useState('5')
  const [resultPts, setResultPts] = useState('3')
  const [customTip, setCustomTip] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!exactCard && !resultCard && !tipCard) return
    setExactPts(exactCard?.value ?? '5')
    setResultPts(resultCard?.value ?? '3')
    setCustomTip(tipCard?.value ?? '')
  }, [exactCard, resultCard, tipCard])

  const previewTip = useMemo(() => {
    const exact = Number.parseInt(exactPts, 10)
    const result = Number.parseInt(resultPts, 10)
    return buildScoringTipMessage(
      Number.isFinite(exact) ? exact : 5,
      Number.isFinite(result) ? result : 3,
      customTip,
    )
  }, [exactPts, resultPts, customTip])

  async function saveCard(card: AdminCard | undefined, value: string) {
    if (!card) return
    await adminUpdateCard({
      key: card.key,
      title: card.title,
      value,
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
    if (!exactCard || !resultCard || !tipCard) {
      setError('Faltan las cards de configuración. Ejecutá la migración SQL (npm run db:push:cloud).')
      return
    }

    const exact = Number.parseInt(exactPts, 10)
    const result = Number.parseInt(resultPts, 10)
    if (!Number.isFinite(exact) || exact < 0 || !Number.isFinite(result) || result < 0) {
      setError('Los puntos deben ser números enteros mayores o iguales a 0.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await Promise.all([
        saveCard(exactCard, String(exact)),
        saveCard(resultCard, String(result)),
        saveCard(tipCard, customTip.trim()),
      ])
      invalidateCards()
      await queryClient.invalidateQueries({ queryKey: scoringDisplayKeys.all })
      await refetch()
      showToast('Puntos y ticker actualizados')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  const missingMigration = !isLoading && (!exactCard || !resultCard || !tipCard)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Competición</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Puntos y ticker</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Ajustá los valores que ven los jugadores en el ticker y en el banner de partidos. Esto no modifica
          el motor de scoring en la base de datos.
        </p>
      </div>

      {missingMigration && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Ejecutá la migración <code className="text-amber-200">20240130000000_competition_display_settings.sql</code>{' '}
          para habilitar esta sección.
        </div>
      )}

      <PremiumCard title="Vista previa del ticker" description="Así se verá el mensaje de puntos en la app">
        <div className="wc26-notification-ticker">
          <div className="wc26-notification-ticker__inner">
            <span className="wc26-notification-ticker__badge" aria-hidden>
              🔔
            </span>
            <div className="wc26-notification-ticker__viewport">
              <p className="wc26-notification-ticker__preview">
                <strong>Tip</strong>
                <span className="opacity-80"> · {previewTip}</span>
              </p>
            </div>
            <span className="wc26-notification-ticker__more" aria-hidden>
              +
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <div className="wc26-fgc-prode-banner__score wc26-fgc-prode-banner__score--blue rounded-xl px-3 py-2">
            <span className="wc26-fgc-prode-banner__score-label">Exacto</span>
            <span className="wc26-fgc-prode-banner__score-pts ml-2">{exactPts || '5'} pts</span>
          </div>
          <div className="wc26-fgc-prode-banner__score wc26-fgc-prode-banner__score--green rounded-xl px-3 py-2">
            <span className="wc26-fgc-prode-banner__score-label">Resultado</span>
            <span className="wc26-fgc-prode-banner__score-pts ml-2">{resultPts || '3'} pts</span>
          </div>
        </div>
      </PremiumCard>

      <PremiumCard title="Editar valores" description="Actualizá a medida que avance el torneo">
        {isLoading ? (
          <p className="text-white/60">Cargando…</p>
        ) : (
          <form className="grid max-w-xl gap-4" onSubmit={handleSave}>
            <label className="space-y-1 text-sm">
              <span className="text-white/50">Puntos por marcador exacto</span>
              <input
                type="number"
                min={0}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
                value={exactPts}
                onChange={e => setExactPts(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-white/50">Puntos por resultado (ganador/empate)</span>
              <input
                type="number"
                min={0}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
                value={resultPts}
                onChange={e => setResultPts(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-white/50">Mensaje personalizado del ticker (opcional)</span>
              <textarea
                rows={3}
                placeholder="Dejá vacío para el texto automático con los puntos de arriba"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
                value={customTip}
                onChange={e => setCustomTip(e.target.value)}
              />
            </label>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div>
              <PremiumButton type="submit" disabled={busy || missingMigration}>
                {busy ? 'Guardando…' : 'Guardar cambios'}
              </PremiumButton>
            </div>
          </form>
        )}
      </PremiumCard>
    </div>
  )
}
