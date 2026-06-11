import { useMemo, useState } from 'react'
import { AdminOrphanScoredAlert } from '../../components/admin/AdminOrphanScoredPanel.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { AdminStatusLight } from '../../components/admin/AdminStatusLight.tsx'
import { OperationalServiceCard } from '../../components/admin/enterprise'
import { useAdminSystemHealth } from '../../hooks/useAdminQueries.ts'
import { enrichHealthServices } from '../../utils/adminOperationsEngine.ts'
import { AdminHealthSemaphore } from '../../components/admin/mobile/AdminHealthSemaphore.tsx'
import { Link } from 'react-router-dom'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'

function formatDate(v: string | null | undefined) {
  if (!v) return '—'
  return new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminSystemHealthPage() {
  const { data, isLoading, error } = useAdminSystemHealth()
  const [showOrphanCases, setShowOrphanCases] = useState(false)

  const services = useMemo(() => (data ? enrichHealthServices(data) : []), [data])

  const redCount = services.filter(s => s.status === 'red').length
  const yellowCount = services.filter(s => s.status === 'yellow').length
  const overall = redCount > 0 ? 'red' : yellowCount > 0 ? 'yellow' : 'green'

  return (
    <div className="admin-ops-center space-y-6">
      <header className="admin-ops-center__hero">
        <div>
          <p className="admin-ops-center__kicker">Sección 4 · Health Center Pro</p>
          <h1 className="admin-ops-center__title">Salud del sistema</h1>
          <p className="admin-ops-center__subtitle">
            Cada servicio con estado, riesgo, acción recomendada e historial.
          </p>
        </div>
        {data ? (
          <div className="admin-ops-center__status">
            <AdminStatusLight status={overall} label="Estado general" />
            <span className="text-xs text-white/50">
              Probe {data.probe_ms} ms · {formatDate(data.generated_at)}
            </span>
          </div>
        ) : null}
      </header>

      {error && (
        <PremiumCard variant="dark">
          <p className="text-red-300">{error instanceof Error ? error.message : 'Error'}</p>
        </PremiumCard>
      )}

      <AdminHealthSemaphore status={overall} redCount={redCount} yellowCount={yellowCount} />

      <div className="hidden justify-end md:flex">
        <Link to="/admin/operations">
          <PremiumButton size="sm" variant="ghost">Revisar alertas</PremiumButton>
        </Link>
      </div>

      {data?.orphan_scored && data.orphan_scored.count > 0 && (
        <AdminOrphanScoredAlert
          orphans={data.orphan_scored}
          showCases={showOrphanCases}
          onViewCases={() => setShowOrphanCases(v => !v)}
        />
      )}

      {services.length > 0 && (
        <div className="admin-ops-services-grid">
          {services.map(svc => (
            <OperationalServiceCard key={svc.id} service={svc} />
          ))}
        </div>
      )}

      {isLoading && <p className="text-white/60">Cargando salud del sistema…</p>}
    </div>
  )
}
