import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle2, Play } from 'lucide-react'
import { adminFetch } from '../../lib/adminApi'

type AuditReport = {
  generatedAt: string
  counts: { pending: number; locked: number; scored: number; total: number }
  platform: {
    totalUsers: number
    totalMatches: number
    finishedMatches: number
    liveMatches: number
    scoredMatches: number
    pendingScoringMatches: number
  }
  unscoredOnFinished: Array<{ predictionId: string; matchId: string; userId: string; status: string }>
  finishedWithoutScoring: Array<{
    matchId: string
    scoreHome: number | null
    scoreAway: number | null
    kickoff: string | null
    pendingPredictions: number
  }>
  inconsistent: Array<{
    predictionId: string
    matchId: string
    userId: string
    status: string
    predictedWinner: string
    scoreHome: number
    scoreAway: number
    derivedWinner: string
  }>
  scoringRules: {
    source: string
    exactScore: number
    correctResult: number
    maxPerMatch: number
    exclusiveExactOrResult: boolean
  }
}

export default function PredictionsAuditPanel() {
  const [report, setReport] = useState<AuditReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [scoringId, setScoringId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch('/api/admin/predictions/audit')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setReport(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando auditoría')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const runScoring = async (matchId: string) => {
    setScoringId(matchId)
    setActionMsg(null)
    try {
      const res = await adminFetch(`/api/admin/predictions/score/${matchId}`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setActionMsg(`Scoring ejecutado en ${matchId}: ${body.predictionsScored ?? 0} predicción(es).`)
      await load()
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Error al puntuar')
    } finally {
      setScoringId(null)
    }
  }

  if (loading) {
    return <p className="wc26-card p-5 text-center text-sm text-white/60">Cargando auditoría de predicciones…</p>
  }

  if (error) {
    return (
      <div className="wc26-card p-5 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <button type="button" onClick={load} className="wc26-btn-blue mt-3 px-4 py-2 text-xs">
          Reintentar
        </button>
      </div>
    )
  }

  if (!report) return null

  const hasIssues =
    report.unscoredOnFinished.length > 0 ||
    report.finishedWithoutScoring.length > 0 ||
    report.inconsistent.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-white">Auditoría de Predicciones</h2>
          <p className="text-xs text-white/55">
            Motor: {report.scoringRules.source} · máx {report.scoringRules.maxPerMatch} pts/partido
            (exacto {report.scoringRules.exactScore} · resultado {report.scoringRules.correctResult})
          </p>
        </div>
        <button type="button" onClick={load} className="wc26-header-icon-btn" aria-label="Actualizar">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {actionMsg && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">{actionMsg}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Pendientes', value: report.counts.pending, tone: 'text-sky-200' },
          { label: 'Bloqueadas', value: report.counts.locked, tone: 'text-orange-200' },
          { label: 'Puntuadas', value: report.counts.scored, tone: 'text-emerald-200' },
          { label: 'Total', value: report.counts.total, tone: 'text-white' },
        ].map(item => (
          <div key={item.label} className="wc26-card p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{item.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="wc26-card p-4">
        <div className="mb-3 flex items-center gap-2">
          {hasIssues ? (
            <AlertTriangle className="h-4 w-4 text-amber-300" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          )}
          <p className="text-sm font-bold text-white">
            {hasIssues ? 'Se detectaron inconsistencias' : 'Sin problemas críticos detectados'}
          </p>
        </div>

        <ul className="space-y-2 text-sm text-white/70">
          <li>Predicciones en partidos finalizados sin puntuar: {report.unscoredOnFinished.length}</li>
          <li>Partidos finalizados sin scoring ejecutado: {report.finishedWithoutScoring.length}</li>
          <li>Predicciones inconsistentes (winner vs marcador): {report.inconsistent.length}</li>
        </ul>
      </div>

      {report.finishedWithoutScoring.length > 0 && (
        <div className="wc26-card p-4">
          <h3 className="mb-3 text-sm font-extrabold text-white">Partidos finished sin scoring</h3>
          <div className="space-y-2">
            {report.finishedWithoutScoring.slice(0, 10).map(row => (
              <div
                key={row.matchId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <div className="text-xs text-white/75">
                  <span className="font-mono">{row.matchId.slice(0, 8)}…</span>
                  {' · '}
                  {row.scoreHome}-{row.scoreAway}
                  {row.pendingPredictions > 0 ? ` · ${row.pendingPredictions} pred. pendientes` : ''}
                </div>
                <button
                  type="button"
                  disabled={scoringId === row.matchId}
                  onClick={() => runScoring(row.matchId)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/80 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  <Play className="h-3 w-3" />
                  {scoringId === row.matchId ? 'Puntuando…' : 'Puntuar manualmente'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.inconsistent.length > 0 && (
        <div className="wc26-card p-4">
          <h3 className="mb-3 text-sm font-extrabold text-white">Predicciones inconsistentes</h3>
          <div className="max-h-48 space-y-2 overflow-y-auto text-xs text-white/70">
            {report.inconsistent.slice(0, 20).map(row => (
              <p key={row.predictionId} className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-amber-100">
                {row.predictedWinner} vs marcador {row.scoreHome}-{row.scoreAway} (implica {row.derivedWinner}) ·{' '}
                {row.status}
              </p>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-white/40">
        Actualizado: {new Date(report.generatedAt).toLocaleString('es-AR')}
      </p>
    </div>
  )
}
