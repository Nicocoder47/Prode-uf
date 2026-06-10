import { useState } from 'react'
import { AdminOrphanScoredAlert } from '../../components/admin/AdminOrphanScoredPanel.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { AdminStatusLight } from '../../components/admin/AdminStatusLight.tsx'
import { useAdminSystemHealth } from '../../hooks/useAdminQueries.ts'

function formatDate(v: string | null | undefined) {
  if (!v) return '—'
  return new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminSystemHealthPage() {
  const { data, isLoading, error } = useAdminSystemHealth()
  const [showOrphanCases, setShowOrphanCases] = useState(false)

  const redCount = data?.services.filter(s => s.status === 'red').length ?? 0
  const yellowCount = data?.services.filter(s => s.status === 'yellow').length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Operaciones</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Salud del sistema</h2>
        <p className="mt-1 text-sm text-white/55">Diagnóstico rápido — objetivo &lt;10 segundos</p>
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
          <div className="flex flex-wrap gap-3">
            <AdminStatusLight status={redCount > 0 ? 'red' : yellowCount > 0 ? 'yellow' : 'green'} label="Estado general" />
            <span className="text-sm text-white/50">Probe: {data.probe_ms} ms · {formatDate(data.generated_at)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.services.map(svc => (
              <div
                key={svc.id}
                className={`rounded-2xl border p-4 ${
                  svc.status === 'green'
                    ? 'border-emerald-400/30 bg-emerald-500/5'
                    : svc.status === 'yellow'
                      ? 'border-amber-400/30 bg-amber-500/5'
                      : 'border-red-400/30 bg-red-500/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-white">{svc.label}</p>
                  <AdminStatusLight status={svc.status} />
                </div>
                <dl className="mt-3 space-y-1 text-xs text-white/70">
                  <div><dt className="inline text-white/45">Última ejecución: </dt><dd className="inline">{formatDate(svc.last_run)}</dd></div>
                  <div><dt className="inline text-white/45">Respuesta: </dt><dd className="inline">{svc.response_ms != null ? `${svc.response_ms} ms` : '—'}</dd></div>
                  <div><dt className="inline text-white/45">Detalle: </dt><dd className="inline">{svc.detail}</dd></div>
                  {svc.last_error && (
                    <div className="text-red-300"><dt className="inline">Error: </dt><dd className="inline">{svc.last_error}</dd></div>
                  )}
                </dl>
              </div>
            ))}
          </div>
        </>
      )}

      {isLoading && <p className="text-white/60">Cargando salud del sistema…</p>}
    </div>
  )
}
