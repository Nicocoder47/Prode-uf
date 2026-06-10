import { useMemo, useState } from 'react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard, StatsPill } from '../../components/ui/PremiumCard.tsx'
import { AdminBetaOverviewCards } from '../../components/admin/AdminBetaOverviewCards.tsx'
import { PUBLIC_DEMO_ACCESS } from '../../config/publicAccess.ts'
import { resolveSupabaseClientConfig } from '../../config/supabaseEnv.ts'
import { useAppToast } from '../../components/ui/ToastProvider.tsx'
import {
  useAdminActivityLogs,
  useAdminBetaCapacity,
  useAdminBetaOverview,
  useAdminDashboard,
  useInvalidateAdmin,
} from '../../hooks/useAdminQueries.ts'
import {
  adminCleanupTestUsers,
  adminCountTestUsers,
} from '../../services/admin/adminService.ts'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminSystemOverviewPage() {
  const { data: dashboard, isLoading, error } = useAdminDashboard()
  const { data: betaOverview, isLoading: betaLoading, error: betaError } = useAdminBetaOverview()
  const { data: betaCapacity } = useAdminBetaCapacity()
  const { data: syncFailures = [] } = useAdminActivityLogs({ type: 'sync_failed', limit: 8 })
  const { data: recentScoring = [] } = useAdminActivityLogs({ type: 'score_calculated', limit: 8 })
  const { data: recentAdminActions = [] } = useAdminActivityLogs({ type: 'user_deleted', limit: 6 })
  const { invalidateAll, invalidateBetaOverview, invalidateUsers } = useInvalidateAdmin()
  const { showToast } = useAppToast()

  const [cleanupPreview, setCleanupPreview] = useState<{ count: number; users: { id: string; email: string; full_name: string }[] } | null>(null)
  const [cleanupConfirm, setCleanupConfirm] = useState('')
  const [cleanupBusy, setCleanupBusy] = useState(false)
  const [previewBusy, setPreviewBusy] = useState(false)

  const supabaseConfig = resolveSupabaseClientConfig()

  const healthChecks = useMemo(
    () => [
      { label: 'Supabase URL', value: supabaseConfig.url ? 'Configurada' : 'Falta', ok: Boolean(supabaseConfig.url) },
      { label: 'Anon key', value: supabaseConfig.anonKey ? 'Presente' : 'Falta', ok: Boolean(supabaseConfig.anonKey) },
      { label: 'Modo demo', value: PUBLIC_DEMO_ACCESS ? 'ACTIVO ⚠' : 'Off', ok: !PUBLIC_DEMO_ACCESS },
      { label: 'Dashboard RPC', value: error ? 'Error' : isLoading ? '…' : 'OK', ok: !error && !isLoading },
      { label: 'Beta overview RPC', value: betaError ? 'Error' : betaLoading ? '…' : 'OK', ok: !betaError && !betaLoading },
    ],
    [supabaseConfig, error, isLoading, betaError, betaLoading],
  )

  const realUsers = betaOverview
    ? Math.max(0, betaOverview.registered_users - betaOverview.test_users_detected)
    : null

  async function handlePreviewCleanup() {
    setPreviewBusy(true)
    try {
      const preview = await adminCountTestUsers()
      setCleanupPreview(preview)
      setCleanupConfirm('')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al contar usuarios test')
    } finally {
      setPreviewBusy(false)
    }
  }

  async function handleCleanup() {
    if (cleanupConfirm !== 'LIMPIAR_TEST') return
    setCleanupBusy(true)
    try {
      const result = await adminCleanupTestUsers('LIMPIAR_TEST')
      showToast(`${result.deleted_count} usuario(s) de prueba eliminados — cupos liberados`)
      setCleanupPreview(null)
      setCleanupConfirm('')
      invalidateAll()
      invalidateBetaOverview()
      invalidateUsers()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error en limpieza')
    } finally {
      setCleanupBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Operaciones</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Centro de sistema</h2>
        <p className="mt-1 text-sm text-white/55">Estado de la beta y herramientas de mantenimiento</p>
      </div>

      {betaOverview && <AdminBetaOverviewCards data={betaOverview} />}

      {betaError && (
        <PremiumCard variant="dark">
          <p className="text-red-300">
            {betaError instanceof Error ? betaError.message : 'Error cargando resumen beta'}
          </p>
        </PremiumCard>
      )}

      <PremiumCard title="Capacidad beta" description="Cupos y composición de usuarios">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatsPill
            label="Límite beta"
            value={String(betaOverview?.max_users ?? 300)}
            highlight
          />
          <StatsPill
            label="Usuarios reales"
            value={realUsers != null ? String(realUsers) : '—'}
            highlight={realUsers != null}
          />
          <StatsPill
            label="Usuarios de prueba"
            value={String(betaOverview?.test_users_detected ?? '—')}
            highlight={!betaOverview?.test_users_detected}
          />
          <StatsPill
            label="Espacio disponible"
            value={String(betaOverview?.available_slots ?? '—')}
            highlight={(betaOverview?.available_slots ?? 0) > 50}
          />
        </div>
        {betaCapacity && (
          <p className="mt-3 text-xs text-white/50">
            Estado capacidad: <strong className="text-white/80">{betaCapacity.status}</strong>
            {' · '}
            {betaCapacity.recommendation}
          </p>
        )}
      </PremiumCard>

      <PremiumCard title="Limpieza de usuarios de prueba" description="Solo emails test/load/demo — nunca admins ni usuarios reales">
        <div className="space-y-3">
          <p className="text-sm text-white/70">
            Detecta usuarios con patrones <code className="text-amber-200">@loadtest.prodemundial.test</code>,{' '}
            <code className="text-amber-200">test</code>, <code className="text-amber-200">demo</code>,{' '}
            <code className="text-amber-200">fake</code>, <code className="text-amber-200">load</code>.
          </p>
          <PremiumButton size="sm" disabled={previewBusy} onClick={handlePreviewCleanup}>
            {previewBusy ? 'Detectando…' : 'Detectar usuarios de prueba'}
          </PremiumButton>

          {cleanupPreview && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 space-y-3">
              <p className="text-sm font-bold text-amber-100">
                {cleanupPreview.count} usuario(s) de prueba detectados
              </p>
              {cleanupPreview.users.length > 0 && (
                <ul className="max-h-40 overflow-y-auto space-y-1 text-xs text-white/70">
                  {cleanupPreview.users.slice(0, 20).map(u => (
                    <li key={u.id}>{u.email} — {u.full_name}</li>
                  ))}
                  {cleanupPreview.users.length > 20 && (
                    <li className="text-white/45">…y {cleanupPreview.users.length - 20} más</li>
                  )}
                </ul>
              )}
              <p className="text-xs text-amber-100/80">Escribí LIMPIAR_TEST para confirmar la eliminación masiva.</p>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={cleanupConfirm}
                onChange={e => setCleanupConfirm(e.target.value)}
                placeholder="LIMPIAR_TEST"
              />
              <div className="flex gap-2">
                <PremiumButton
                  size="sm"
                  variant="danger"
                  disabled={cleanupBusy || cleanupConfirm !== 'LIMPIAR_TEST' || cleanupPreview.count === 0}
                  onClick={handleCleanup}
                >
                  {cleanupBusy ? 'Eliminando…' : `Eliminar ${cleanupPreview.count} usuario(s)`}
                </PremiumButton>
                <PremiumButton size="sm" variant="ghost" onClick={() => setCleanupPreview(null)}>
                  Cancelar
                </PremiumButton>
              </div>
            </div>
          )}
        </div>
      </PremiumCard>

      <PremiumCard title="Salud básica" description="Checks locales (sin Express)">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      <PremiumCard title="Acciones admin recientes" description="Eliminaciones y limpiezas">
        <div className="space-y-2">
          {recentAdminActions.length ? (
            recentAdminActions.map(log => (
              <div key={log.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                <p className="font-semibold text-white">{log.title}</p>
                <p className="text-xs text-white/50">{formatDate(log.created_at)}</p>
                {log.description && <p className="mt-1 text-xs text-white/70">{log.description}</p>}
              </div>
            ))
          ) : (
            <p className="text-sm text-white/50">Sin eliminaciones recientes</p>
          )}
        </div>
      </PremiumCard>
    </div>
  )
}
