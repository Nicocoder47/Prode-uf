import { useMemo, useState } from 'react'
import { AdminOrphanScoredAlert } from '../../components/admin/AdminOrphanScoredPanel.tsx'
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

  const canScore = (status: string) => status === 'finished'
  const scoreDisabledTitle = 'Solo se pueden puntuar partidos finalizados.'

  const filtered = useMemo(() => {
    const list = data?.matches ?? []
    if (!filter) return list
    return list.filter(m => m.scoring_status === filter)
  }, [data?.matches, filter])

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
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Operaciones</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Centro de Scoring</h2>
        <p className="mt-1 text-sm text-white/55">Usa score_match_predictions y rescore_match_predictions — sin motores paralelos</p>
      </div>

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

          <PremiumCard title="Acciones globales">
            <div className="flex flex-wrap gap-2">
              <PremiumButton size="sm" disabled={!!busy} onClick={() => run('Recalcular leaderboard', adminRecalculateLeaderboard)}>
                Recalcular leaderboard
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
                onClick={() => run(`Scoring jornada ${roundInput}`, () => adminScoreRound(roundInput.trim()))}
              >
                Recalcular jornada
              </PremiumButton>
            </div>
          </PremiumCard>
        </>
      )}

      <PremiumCard title="Partidos" description={isLoading ? 'Cargando…' : `${filtered.length} partidos`}>
        <div className="mb-3 flex flex-wrap gap-2">
          {['', 'pending_scoring', 'scored', 'live', 'scheduled'].map(f => (
            <PremiumButton key={f || 'all'} size="sm" variant={filter === f ? 'primary' : 'ghost'} onClick={() => setFilter(f)}>
              {f || 'Todos'}
            </PremiumButton>
          ))}
        </div>
        <div className="overflow-x-auto">
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
    </div>
  )
}
