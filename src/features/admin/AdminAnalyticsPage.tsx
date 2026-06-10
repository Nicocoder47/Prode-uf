import { PremiumCard, StatsPill } from '../../components/ui/PremiumCard.tsx'
import { useAdminAnalytics } from '../../hooks/useAdminQueries.ts'

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-white/70">
        <span className="truncate pr-2">{label}</span>
        <span className="font-bold text-white">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-amber-400/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const { data, isLoading, error } = useAdminAnalytics()

  const maxMatchPreds = Math.max(1, ...(data?.top_matches_by_predictions.map(m => m.prediction_count) ?? [1]))
  const maxUserAct = Math.max(1, ...(data?.top_active_users.map(u => u.activity_count) ?? [1]))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Participación</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Analytics</h2>
        <p className="mt-1 text-sm text-white/55">Agregaciones SQL optimizadas — sin consultas pesadas</p>
      </div>

      {error && (
        <PremiumCard variant="dark">
          <p className="text-red-300">{error instanceof Error ? error.message : 'Error'}</p>
        </PremiumCard>
      )}

      {isLoading && <p className="text-white/60">Cargando analytics…</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatsPill label="Registrados" value={String(data.registered_users)} highlight />
            <StatsPill label="Activos hoy" value={String(data.active_today)} />
            <StatsPill label="Activos semana" value={String(data.active_week)} />
            <StatsPill label="Activos mes" value={String(data.active_month)} />
            <StatsPill label="Predicciones" value={String(data.total_predictions)} />
            <StatsPill label="Pendientes" value={String(data.pending_predictions)} />
            <StatsPill label="Promedio / usuario" value={String(data.avg_predictions_per_user)} />
            <StatsPill label="Tasa participación" value={`${data.participation_rate_pct}%`} highlight={data.participation_rate_pct > 50} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PremiumCard title="Top 10 usuarios activos (30d)">
              <div className="space-y-3">
                {data.top_active_users.map(u => (
                  <Bar key={u.email} label={`${u.full_name} (${u.email})`} value={u.activity_count} max={maxUserAct} />
                ))}
                {!data.top_active_users.length && <p className="text-sm text-white/50">Sin actividad reciente</p>}
              </div>
            </PremiumCard>

            <PremiumCard title="Top partidos con más predicciones">
              <div className="space-y-3">
                {data.top_matches_by_predictions.map(m => (
                  <Bar
                    key={m.id}
                    label={`${m.home_team ?? '?'} vs ${m.away_team ?? '?'}`}
                    value={m.prediction_count}
                    max={maxMatchPreds}
                  />
                ))}
              </div>
            </PremiumCard>

            <PremiumCard title="Selecciones más elegidas (ganador)">
              <div className="space-y-2 text-sm">
                {data.top_winner_picks.map(w => (
                  <div key={w.choice} className="flex justify-between border-b border-white/5 py-1">
                    <span className="text-white/80">{w.choice}</span>
                    <span className="font-bold text-amber-200">{w.pick_count}</span>
                  </div>
                ))}
              </div>
            </PremiumCard>

            <PremiumCard title="Resultados más elegidos (marcador)">
              <div className="space-y-2 text-sm">
                {data.top_scoreline_picks.map(s => (
                  <div key={s.scoreline} className="flex justify-between border-b border-white/5 py-1">
                    <span className="font-mono text-white/80">{s.scoreline}</span>
                    <span className="font-bold text-amber-200">{s.pick_count}</span>
                  </div>
                ))}
              </div>
            </PremiumCard>
          </div>
        </>
      )}
    </div>
  )
}
