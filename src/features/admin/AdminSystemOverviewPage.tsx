import { useMemo } from 'react'
import { PremiumCard, StatsPill } from '../../components/ui/PremiumCard'
import { PUBLIC_DEMO_ACCESS } from '../../config/publicAccess'
import { resolveSupabaseClientConfig } from '../../config/supabaseEnv'
import { useAdminActivityLogs, useAdminDashboard } from '../../hooks/useAdminQueries'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminSystemOverviewPage() {
  const { data: dashboard, isLoading, error } = useAdminDashboard()
  const { data: syncFailures = [] } = useAdminActivityLogs({ type: 'sync_failed', limit: 8 })
  const { data: recentScoring = [] } = useAdminActivityLogs({ type: 'score_calculated', limit: 8 })

  const supabaseConfig = resolveSupabaseClientConfig()

  const healthChecks = useMemo(
    () => [
      { label: 'Supabase URL', value: supabaseConfig.url ? 'Configurada' : 'Falta', ok: Boolean(supabaseConfig.url) },
      { label: 'Anon key', value: supabaseConfig.anonKey ? 'Presente' : 'Falta', ok: Boolean(supabaseConfig.anonKey) },
      { label: 'Modo demo', value: PUBLIC_DEMO_ACCESS ? 'ACTIVO ⚠' : 'Off', ok: !PUBLIC_DEMO_ACCESS },
      { label: 'Dashboard RPC', value: error ? 'Error' : isLoading ? '…' : 'OK', ok: !error && !isLoading },
    ],
    [supabaseConfig, error, isLoading],
  )

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Operaciones</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Centro de sistema</h2>
        <p className="mt-1 text-sm text-white/55">Solo lectura — estado de plataforma y sync</p>
      </div>

      <PremiumCard title="Salud básica" description="Checks locales (sin Express)">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {healthChecks.map(item => (
            <StatsPill
              key={item.label}
              label={item.label}
              value={item.value}
              highlight={item.ok}
            />
          ))}
        </div>
      </PremiumCard>

      {dashboard && (
        <PremiumCard title="Partidos en base" description="Snapshot operativo">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatsPill label="Scheduled" value={String(dashboard.scheduled_matches)} />
            <StatsPill label="En vivo" value={String(dashboard.live_matches)} highlight />
            <StatsPill label="Finalizados" value={String(dashboard.finished_matches)} />
          </div>
        </PremiumCard>
      )}

      <PremiumCard title="Último sync" description="data_sync_logs vía dashboard RPC">
        {dashboard?.last_sync ? (
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-white/50">Estado:</span>{' '}
              <strong className={dashboard.last_sync.status === 'ok' ? 'text-emerald-300' : 'text-red-300'}>
                {dashboard.last_sync.status}
              </strong>
            </p>
            <p>
              <span className="text-white/50">Tipo:</span> {dashboard.last_sync.sync_type} ({dashboard.last_sync.provider})
            </p>
            <p>
              <span className="text-white/50">Registros:</span> {dashboard.last_sync.records_upserted}
            </p>
            <p>
              <span className="text-white/50">Inicio:</span> {formatDate(dashboard.last_sync.started_at)}
            </p>
            {dashboard.last_sync.error_message && (
              <p className="text-red-300">{dashboard.last_sync.error_message}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/50">{isLoading ? 'Cargando…' : 'Sin registros de sync'}</p>
        )}
      </PremiumCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <PremiumCard title="Sync fallidos recientes" description="activity_logs">
          <div className="space-y-2">
            {syncFailures.length ? (
              syncFailures.map(log => (
                <div key={log.id} className="rounded-xl border border-red-400/20 bg-red-500/5 px-3 py-2 text-sm">
                  <p className="font-semibold text-white">{log.title}</p>
                  <p className="text-xs text-white/50">{formatDate(log.created_at)}</p>
                  {log.description && <p className="mt-1 text-xs text-red-200">{log.description}</p>}
                </div>
              ))
            ) : (
              <p className="text-sm text-white/50">Sin fallos recientes</p>
            )}
          </div>
        </PremiumCard>

        <PremiumCard title="Scoring reciente" description="activity_logs">
          <div className="space-y-2">
            {recentScoring.length ? (
              recentScoring.map(log => (
                <div key={log.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                  <p className="font-semibold text-white">{log.title}</p>
                  <p className="text-xs text-white/50">{formatDate(log.created_at)}</p>
                  {log.description && <p className="mt-1 text-xs text-white/70">{log.description}</p>}
                </div>
              ))
            ) : (
              <p className="text-sm text-white/50">Sin eventos de scoring</p>
            )}
          </div>
        </PremiumCard>
      </div>

      <PremiumCard title="Notas" description="Fase 1 — read-only">
        <ul className="list-inside list-disc space-y-1 text-sm text-white/70">
          <li>No se editan resultados ni scoring desde este panel.</li>
          <li>Sync en producción corre vía GitHub Actions (~cada 15 min).</li>
          <li>Métricas avanzadas (RPC probes, Realtime) llegan en Fase 2.</li>
        </ul>
      </PremiumCard>
    </div>
  )
}
