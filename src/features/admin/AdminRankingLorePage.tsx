import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { useAppToast } from '../../components/ui/ToastProvider.tsx'
import { LiveInsightCard } from '../../components/worldcup/LiveInsightCard.tsx'
import {
  buildRankingLoreFromLeaderboard,
  DEFAULT_RANKING_LORE,
  RANKING_LORE_CARD_KEYS,
  type RankingLoreConfig,
} from '../../config/rankingLore.ts'
import { useAdminCards, useInvalidateAdmin } from '../../hooks/useAdminQueries.ts'
import { rankingLoreKeys } from '../../hooks/useRankingLoreConfig.ts'
import { adminUpdateCard } from '../../services/admin/adminService.ts'
import type { AdminCard } from '../../types/admin.ts'
import { useLeaderboard } from '../../useWorldCupData.ts'
import { toRankingLoreDisplay } from '../../utils/worldCupLiveInsights.ts'
import type { RankingMoveInsight } from '../../utils/worldCupLiveInsights.ts'

function findCard(cards: AdminCard[], key: string) {
  return cards.find(card => card.key === key)
}

function buildPreviewCard(config: RankingLoreConfig | null): RankingMoveInsight {
  return {
    id: 'preview-ranking-lore',
    type: 'ranking_move',
    emoji: config?.emoji ?? '🎯',
    title: 'Movimiento del ranking',
    lines: [],
    leader: null,
    runnerUp: null,
    lore: config ? toRankingLoreDisplay(config) : null,
    cta: { label: 'Ver ranking', action: 'leaderboard' },
  }
}

export default function AdminRankingLorePage() {
  const { data: cards = [], isLoading, refetch } = useAdminCards()
  const { data: leaderboard = [] } = useLeaderboard()
  const { invalidateCards } = useInvalidateAdmin()
  const queryClient = useQueryClient()
  const { showToast } = useAppToast()

  const enabledCard = findCard(cards, RANKING_LORE_CARD_KEYS.enabled)
  const autoCard = findCard(cards, RANKING_LORE_CARD_KEYS.auto)
  const emojiCard = findCard(cards, RANKING_LORE_CARD_KEYS.emoji)
  const headlineCard = findCard(cards, RANKING_LORE_CARD_KEYS.headline)
  const subjectCard = findCard(cards, RANKING_LORE_CARD_KEYS.subject)
  const bodyCard = findCard(cards, RANKING_LORE_CARD_KEYS.body)
  const distanceCard = findCard(cards, RANKING_LORE_CARD_KEYS.distance)
  const objectiveCard = findCard(cards, RANKING_LORE_CARD_KEYS.objective)

  const [enabled, setEnabled] = useState(DEFAULT_RANKING_LORE.enabled)
  const [autoFromLeaderboard, setAutoFromLeaderboard] = useState(DEFAULT_RANKING_LORE.autoFromLeaderboard)
  const [emoji, setEmoji] = useState(DEFAULT_RANKING_LORE.emoji)
  const [headline, setHeadline] = useState(DEFAULT_RANKING_LORE.headline)
  const [subjectName, setSubjectName] = useState(DEFAULT_RANKING_LORE.subjectName)
  const [body, setBody] = useState(DEFAULT_RANKING_LORE.body)
  const [subjectPoints, setSubjectPoints] = useState(String(DEFAULT_RANKING_LORE.subjectPoints))
  const [objective, setObjective] = useState(DEFAULT_RANKING_LORE.objective)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabledCard && !headlineCard && !bodyCard) return
    setEnabled(enabledCard?.value === '1')
    setAutoFromLeaderboard(autoCard ? autoCard.value === '1' : true)
    setEmoji(emojiCard?.icon ?? emojiCard?.value ?? DEFAULT_RANKING_LORE.emoji)
    setHeadline(headlineCard?.value ?? DEFAULT_RANKING_LORE.headline)
    setSubjectName(subjectCard?.value ?? DEFAULT_RANKING_LORE.subjectName)
    setBody(bodyCard?.description ?? bodyCard?.value ?? DEFAULT_RANKING_LORE.body)
    setSubjectPoints(distanceCard?.value ?? String(DEFAULT_RANKING_LORE.subjectPoints))
    setObjective(objectiveCard?.value ?? DEFAULT_RANKING_LORE.objective)
  }, [enabledCard, autoCard, emojiCard, headlineCard, subjectCard, bodyCard, distanceCard, objectiveCard])

  const templateConfig = useMemo<RankingLoreConfig>(
    () => ({
      enabled,
      autoFromLeaderboard,
      emoji: emoji.trim() || '🎯',
      headline: headline.trim(),
      subjectName: subjectName.trim(),
      body: body.trim(),
      subjectPoints: Number.parseInt(subjectPoints, 10) || 0,
      objective: objective.trim(),
    }),
    [enabled, autoFromLeaderboard, emoji, headline, subjectName, body, subjectPoints, objective],
  )

  const previewLore = useMemo(
    () => buildRankingLoreFromLeaderboard(leaderboard, templateConfig),
    [leaderboard, templateConfig],
  )

  const previewCard = useMemo(() => buildPreviewCard(previewLore), [previewLore])

  const runnerUpPreview = leaderboard.find(entry => entry.rank === 2) ?? leaderboard[1]

  async function saveCard(card: AdminCard | undefined, patch: Partial<AdminCard> & { value?: string }) {
    if (!card) return
    await adminUpdateCard({
      key: card.key,
      title: card.title,
      value: patch.value ?? card.value ?? undefined,
      subtitle: card.subtitle ?? undefined,
      description: patch.description ?? card.description ?? undefined,
      icon: patch.icon ?? card.icon ?? undefined,
      status: card.status,
      orderIndex: card.order_index,
      isActive: card.is_active,
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!enabledCard || !emojiCard || !headlineCard || !subjectCard || !bodyCard || !distanceCard || !objectiveCard) {
      setError('Faltan las cards de configuración. Ejecutá la migración SQL (npm run db:push:cloud).')
      return
    }

    if (!autoFromLeaderboard) {
      const points = Number.parseInt(subjectPoints, 10)
      if (!Number.isFinite(points) || points < 0) {
        setError('Los puntos deben ser un número entero mayor o igual a 0.')
        return
      }
      if (!headline.trim()) {
        setError('El titular no puede estar vacío.')
        return
      }
      if (!body.trim()) {
        setError('El párrafo narrativo no puede estar vacío.')
        return
      }
    }

    setBusy(true)
    setError(null)
    try {
      const saves = [
        saveCard(enabledCard, { value: enabled ? '1' : '0' }),
        saveCard(emojiCard, { value: emoji.trim() || '🎯', icon: emoji.trim() || '🎯' }),
        saveCard(headlineCard, { value: headline.trim() }),
        saveCard(objectiveCard, { value: objective.trim() }),
      ]

      if (autoCard) {
        saves.push(saveCard(autoCard, { value: autoFromLeaderboard ? '1' : '0' }))
      }

      if (!autoFromLeaderboard) {
        saves.push(
          saveCard(subjectCard, { value: subjectName.trim() }),
          saveCard(bodyCard, { description: body.trim() }),
          saveCard(distanceCard, { value: String(Number.parseInt(subjectPoints, 10) || 0) }),
        )
      }

      await Promise.all(saves)
      invalidateCards()
      await queryClient.invalidateQueries({ queryKey: rankingLoreKeys.all })
      await refetch()
      showToast('Lore del ranking actualizado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setBusy(false)
    }
  }

  const missingMigration =
    !isLoading &&
    (!enabledCard || !emojiCard || !headlineCard || !subjectCard || !bodyCard || !distanceCard || !objectiveCard)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Mundial en Vivo</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Lore del ranking</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          La card puede tomar al <strong className="text-white/80">2° del ranking</strong> en vivo y renovarse sola cada
          ~30 segundos junto con el leaderboard.
        </p>
        <p className="mt-2 text-sm text-white/45">
          Preview en{' '}
          <Link to="/admin/live-cards" className="text-emerald-300 underline">
            Mundial Vivo
          </Link>
          .
        </p>
      </div>

      {missingMigration && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          Ejecutá la migración <code className="text-amber-200">20240131000000_ranking_lore_settings.sql</code> para
          habilitar esta sección.
        </div>
      )}

      <PremiumCard
        title="Vista previa en vivo"
        description="Datos reales del leaderboard — se actualiza automáticamente"
      >
        <div className="max-w-sm">
          {previewLore ? (
            <LiveInsightCard card={previewCard} active />
          ) : enabled ? (
            <p className="text-sm text-amber-100/90">
              No hay 2° puesto en el ranking todavía. La card mostrará el podio clásico hasta que haya al menos dos
              jugadores.
            </p>
          ) : (
            <p className="text-sm text-white/55">
              El lore está desactivado. Los jugadores verán el podio automático (1° y 2° del leaderboard).
            </p>
          )}
        </div>
        {autoFromLeaderboard && runnerUpPreview ? (
          <p className="mt-3 text-xs text-white/45">
            2° actual: {runnerUpPreview.profile?.fullName ?? runnerUpPreview.profile?.legajo ?? '—'} ·{' '}
            {runnerUpPreview.points} pts
          </p>
        ) : null}
      </PremiumCard>

      <PremiumCard title="Editar lore" description="Plantilla editorial + modo automático">
        {isLoading ? (
          <p className="text-white/60">Cargando…</p>
        ) : (
          <form className="grid max-w-xl gap-4" onSubmit={handleSave}>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-white/5"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
              />
              <span className="text-white/80">Mostrar lore en lugar del podio automático</span>
            </label>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20 bg-white/5"
                checked={autoFromLeaderboard}
                onChange={e => setAutoFromLeaderboard(e.target.checked)}
              />
              <span className="text-white/80">
                Actualizar automáticamente desde el 2° del ranking (recomendado)
              </span>
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/50">Emoji del titular</span>
              <input
                type="text"
                maxLength={4}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
                value={emoji}
                onChange={e => setEmoji(e.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-white/50">
                Titular {autoFromLeaderboard ? '(opcional — si está vacío se elige según la distancia)' : ''}
              </span>
              <input
                type="text"
                required={!autoFromLeaderboard}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white uppercase"
                value={headline}
                onChange={e => setHeadline(e.target.value)}
              />
            </label>

            {!autoFromLeaderboard ? (
              <>
                <label className="space-y-1 text-sm">
                  <span className="text-white/50">Protagonista</span>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
                    value={subjectName}
                    onChange={e => setSubjectName(e.target.value)}
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-white/50">Párrafo narrativo</span>
                  <textarea
                    rows={4}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="text-white/50">Puntos del protagonista</span>
                  <input
                    type="number"
                    min={0}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
                    value={subjectPoints}
                    onChange={e => setSubjectPoints(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-sm text-emerald-100/90">
                Protagonista, puntos y párrafo se generan solos desde el 2° puesto del ranking.
              </p>
            )}

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
