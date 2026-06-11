import { useMemo, useState } from 'react'
import { AdminOrphanScoredAlert } from '../../components/admin/AdminOrphanScoredPanel.tsx'
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal.tsx'
import { AdminScoringMatchCard } from '../../components/admin/mobile/AdminScoringMatchCard.tsx'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard, StatsPill } from '../../components/ui/PremiumCard.tsx'
import { AdminStatusLight, scoringStatusLight } from '../../components/admin/AdminStatusLight.tsx'
import { useAppToast } from '../../components/ui/ToastProvider.tsx'
import { useAdminScoringCenter, useInvalidateAdmin } from '../../hooks/useAdminQueries.ts'
import {
  adminRecalculateLeaderboard,
  adminRescoreMatch,
  adminScoreMatch,
  adminScoreRound,
} from '../../services/admin/adminService.ts'
import type { AdminScoringMatchRow } from '../../types/admin.ts'

function formatDate(v: string | null | undefined) {
  if (!v) return '—'
  return new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminScoringPage() {
  const { data, isLoading, error, refetch } = useAdminScoringCenter()
  const { invalidateDashboard } = useInvalidateAdmin()
  const { showToast } = useAppToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [roundInput, setRoundInput] = useState('')
  const [showOrphanCases, setShowOrphanCases] = useState(false)
  const [confirmLeaderboard, setConfirmLeaderboard] = useState(false)
  const [confirmRound, setConfirmRound] = useState(false)
  const [confirmPhrase, setConfirmPhrase] = useState('')

  const canScore = (status: string) => status === 'finished'
  const scoreDisabledTitle = 'Solo partidos finalizados'

  function isToday(iso: string | null | undefined) {
    if (!iso) return false
    return new Date(iso).toDateString() === new Date().toDateString()
  }

  function hasScoringError(m: AdminScoringMatchRow) {
    const known = ['pending_scoring', 'scored', 'live', 'scheduled']
    if (known.includes(m.scoring_status)) return false
    if (String(m.scoring_status).includes('error')) return true
    return m.status === 'finished' && m.scoring_status !== 'scored' && m.scoring_status !== 'pending_scoring'
  }

  const filtered = useMemo(() => {
    const list = data?.matches ?? []
    if (!filter) return list
    if (filter === 'today') return list.filter(m => isToday(m.kick_off))
    if (filter === 'finished') return list.filter(m => m.status === 'finished')
    if (filter === 'error') return list.filter(hasScoringError)
    if (filter === 'with_predictions') return list.filter(m => m.predictions_total > 0)
    return list.filter(m => m.scoring_status === filter)
  }, [data?.matches, filter])

  const mobileFilters = [
    { id: '', label: 'Todos' },
    { id: 'today', label: 'Hoy' },
    { id: 'pending_scoring', label: 'Pendientes' },
    { id: 'finished', label: 'Finalizados' },
    { id: 'error', label: 'Con error' },
    { id: 'with_predictions', label: 'Con predicciones' },
  ] as const

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label)
    try {
      await action()
      showToast(`${label} ejecutado`)
      await refetch()
      invalidateDashboard()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <header className="admin-ops-center__hero">
        <div>
          <p className="admin-ops-center__kicker">Sección 3 · Scoring Center Pro</p>
          <h1 className="admin-ops-center__title">Centro de Scoring</h1>
          <p className="admin-ops-center__subtitle">
            Partidos pendientes, huérfanas, rescoring y validación de integridad — motor único score_match_predictions.
          </p>
        </div>
      </header>

      {error && (
        <PremiumCard variant="dark">
          <p className="text-red-300">{error instanceof Error ? error.message : 'Error'}</p>
        </PremiumCard>
      )}

      {data?.orphan_scored && data.orphan_scored.count > 0 && (
        <AdminOrphanScoredAlert
          orphans={data.orphan_scored}
          showCases={showOrphanCases}
          onViewCases={() => setShowOrphanCases(v => !v)}
        />
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatsPill label="Pendientes" value={String(data.summary.pending_scoring)} highlight={data.summary.pending_scoring === 0} />
            <StatsPill label="Puntuados" value={String(data.summary.scored)} highlight />
            <StatsPill label="En vivo" value={String(data.summary.live)} />
            <StatsPill label="Programados" value={String(data.summary.scheduled)} />
            <StatsPill label="Con error" value={String(data.summary.errors)} highlight={data.summary.errors === 0} />
          </div>

          <PremiumCard title="Últimas ejecuciones" description="activity_logs">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <p><span className="text-white/50">Último scoring:</span> {formatDate(data.last_score_at)}</p>
              <p><span className="text-white/50">Último rescoring:</span> {formatDate(data.last_rescore_at)}</p>
            </div>
          </PremiumCard>

          <PremiumCard title="Acciones globales" description="Re-score torneo, validar integridad y simular flujos">
            <div className="mb-3 grid gap-2 text-xs text-white/60 sm:grid-cols-2">
              <p><strong className="text-white/80">Huérfanas:</strong> {data.orphan_scored?.count ?? 0} — predicciones puntuadas en partidos no finalizados</p>
              <p><strong className="text-white/80">Inconsistentes:</strong> {data.summary.errors} — estados de scoring fuera de norma</p>
              <p><strong className="text-white/80">Puntuados:</strong> {data.summary.scored} partidos procesados</p>
              <p><strong className="text-white/80">Tiempo último scoring:</strong> {formatDate(data.last_score_at)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PremiumButton size="sm" disabled={!!busy} onClick={() => setConfirmLeaderboard(true)}>
                Re-score torneo (leaderboard)
              </PremiumButton>
              <PremiumButton
                size="sm"
                variant="ghost"
                disabled={!!busy}
                onClick={() => {
                  setFilter('pending_scoring')
                  showToast('Filtrado: partidos pendientes de puntuar')
                }}
              >
                Validar integridad
              </PremiumButton>
              <input
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="Jornada / fase (ej. Group A)"
                value={roundInput}
                onChange={e => setRoundInput(e.target.value)}
              />
              <PremiumButton
                size="sm"
                variant="ghost"
                disabled={!!busy || !roundInput.trim()}
                onClick={() => setConfirmRound(true)}
              >
                Recalcular jornada
              </PremiumButton>
            </div>
          </PremiumCard>
        </>
      )}

      <PremiumCard title="Partidos" description={isLoading ? 'Cargando…' : `${filtered.length} partidos`}>
        <div className="admin-scoring-filters mb-3 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
          {mobileFilters.map(f => (
            <PremiumButton key={f.id || 'all'} size="sm" variant={filter === f.id ? 'primary' : 'ghost'} onClick={() => setFilter(f.id)}>
              {f.label}
            </PremiumButton>
          ))}
        </div>

        <div className="admin-scoring-mobile-list space-y-3 md:hidden">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="admin-ops-skeleton__card h-32" />)
          ) : filtered.length === 0 ? (
            <p className="admin-empty-state">Sin partidos para este filtro</p>
          ) : (
            filtered.map(m => (
              <AdminScoringMatchCard
                key={m.id}
                match={m}
                busy={busy === m.id}
                onScore={() => run(`Scoring ${m.id}`, () => adminScoreMatch(m.id))}
                onRescore={() => run(`Rescore ${m.id}`, () => adminRescoreMatch(m.id, m.score_home!, m.score_away!))}
              />
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase text-white/50">
                <th className="py-2 pr-3">Partido</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Pred.</th>
                <th className="py-2 pr-3">Puntajes</th>
                <th className="py-2 pr-3">Procesado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b border-white/5">
                  <td className="py-2 pr-3 text-white">
                    <div className="font-semibold">{m.home_team ?? '?'} vs {m.away_team ?? '?'}</div>
                    <div className="text-xs text-white/45">{m.phase ?? '—'} · {formatDate(m.kick_off)}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <AdminStatusLight status={scoringStatusLight(m.scoring_status)} label={m.scoring_status} />
                    <div className="mt-1 font-mono text-xs text-white/60">
                      {m.score_home != null ? `${m.score_home}-${m.score_away}` : '—'}
                    </div>
                  </td>
                  <td className="py-2 pr-3">{m.predictions_scored}/{m.predictions_total}</td>
                  <td className="py-2 pr-3 font-bold text-wc26-yellow">{m.points_assigned}</td>
                  <td className="py-2 pr-3 text-xs text-white/50">{formatDate(m.scored_at)}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {m.scoring_status === 'pending_scoring' && canScore(m.status) && (
                        <PremiumButton
                          size="sm"
                          disabled={busy === m.id}
                          onClick={() => run(`Scoring ${m.id}`, () => adminScoreMatch(m.id))}
                        >
                          Puntuar
                        </PremiumButton>
                      )}
                      {m.predictions_total > 0 && !canScore(m.status) && (
                        <PremiumButton
                          size="sm"
                          disabled
                          title={scoreDisabledTitle}
                        >
                          Puntuar
                        </PremiumButton>
                      )}
                      {m.scoring_status === 'scored' && canScore(m.status) && m.score_home != null && m.score_away != null && (
                        <PremiumButton
                          size="sm"
                          variant="ghost"
                          disabled={busy === m.id}
                          onClick={() => run(`Rescore ${m.id}`, () => adminRescoreMatch(m.id, m.score_home!, m.score_away!))}
                        >
                          Recalcular
                        </PremiumButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>

      <AdminConfirmModal
        open={confirmLeaderboard}
        title="Recalcular leaderboard completo"
        description={
          <p>
            Se recalculará el ranking de <strong>todos los usuarios</strong> según las predicciones puntuadas actuales.
            Puede tardar varios segundos.
          </p>
        }
        confirmLabel="Recalcular leaderboard"
        confirmPhrase="RECALCULAR"
        confirmValue={confirmPhrase}
        onConfirmValueChange={setConfirmPhrase}
        reversible={false}
        busy={!!busy}
        onCancel={() => { setConfirmLeaderboard(false); setConfirmPhrase('') }}
        onConfirm={() => {
          run('Recalcular leaderboard', adminRecalculateLeaderboard).finally(() => {
            setConfirmLeaderboard(false)
            setConfirmPhrase('')
          })
        }}
      />

      <AdminConfirmModal
        open={confirmRound}
        title={`Recalcular jornada: ${roundInput}`}
        description={
          <p>
            Se ejecutará scoring para todos los partidos finalizados de la fase/jornada <strong>{roundInput}</strong>.
          </p>
        }
        confirmLabel="Recalcular jornada"
        confirmPhrase="JORNADA"
        confirmValue={confirmPhrase}
        onConfirmValueChange={setConfirmPhrase}
        reversible={false}
        busy={!!busy}
        onCancel={() => { setConfirmRound(false); setConfirmPhrase('') }}
        onConfirm={() => {
          run(`Scoring jornada ${roundInput}`, () => adminScoreRound(roundInput.trim())).finally(() => {
            setConfirmRound(false)
            setConfirmPhrase('')
          })
        }}
      />
    </div>
  )
}
