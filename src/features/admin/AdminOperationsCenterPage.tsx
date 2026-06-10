import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AdminStatusLight } from '../../components/admin/AdminStatusLight.tsx'
import {
  ExecutiveMetricsGrid,
  OperationsAlertCenter,
  OperationsRecommendationBar,
} from '../../components/admin/enterprise'
import {
  useAdminBetaCapacity,
  useAdminBetaOverview,
  useAdminDashboard,
  useAdminScoringCenter,
  useAdminSystemHealth,
} from '../../hooks/useAdminQueries.ts'
import {
  buildCapacityMetrics,
  buildExecutiveUserMetrics,
  buildOperationalAlerts,
  buildOperationalRecommendations,
  overallStatusFromAlerts,
} from '../../utils/adminOperationsEngine.ts'

const QUICK_LINKS = [
  { to: '/admin/scoring', label: 'Scoring Center' },
  { to: '/admin/health', label: 'Health Center' },
  { to: '/admin/users', label: 'Users Center' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/notifications', label: 'Notificaciones' },
  { to: '/admin/beta-capacity', label: 'Capacidad / API' },
  { to: '/admin/activity', label: 'Auditoría' },
  { to: '/admin/system', label: 'Configuración' },
] as const

export default function AdminOperationsCenterPage() {
  const { data: dashboard } = useAdminDashboard()
  const { data: capacity } = useAdminBetaCapacity()
  const { data: overview } = useAdminBetaOverview()
  const { data: health } = useAdminSystemHealth()
  const { data: scoring } = useAdminScoringCenter()

  const userMetrics = useMemo(
    () => (dashboard ? buildExecutiveUserMetrics(dashboard, capacity, overview) : []),
    [dashboard, capacity, overview],
  )

  const capacityMetrics = useMemo(
    () => buildCapacityMetrics(capacity, overview),
    [capacity, overview],
  )

  const alerts = useMemo(
    () =>
      buildOperationalAlerts({
        dashboard,
        capacity,
        overview,
        health,
        scoring,
      }),
    [dashboard, capacity, overview, health, scoring],
  )

  const recommendations = useMemo(
    () => buildOperationalRecommendations(alerts, capacity),
    [alerts, capacity],
  )

  const overall = overallStatusFromAlerts(alerts)

  if (!dashboard) {
    return <p className="text-white/60">Cargando centro de operaciones…</p>
  }

  return (
    <div className="admin-ops-center space-y-8">
      <header className="admin-ops-center__hero">
        <div>
          <p className="admin-ops-center__kicker">NOC · CRM · Control Room</p>
          <h1 className="admin-ops-center__title">Centro de Operaciones Enterprise</h1>
          <p className="admin-ops-center__subtitle">
            Gestión completa del Mundial 2026 — estado, riesgo y acción en cada métrica.
          </p>
        </div>
        <div className="admin-ops-center__status">
          <AdminStatusLight status={overall} label="Estado operativo" />
        </div>
      </header>

      <OperationsRecommendationBar items={recommendations} />

      <ExecutiveMetricsGrid title="Usuarios" kicker="Dashboard ejecutivo" metrics={userMetrics} />
      <ExecutiveMetricsGrid title="Capacidad beta" kicker="Cupo y proyección" metrics={capacityMetrics} />

      <OperationsAlertCenter alerts={alerts} />

      <section className="admin-ops-section">
        <header className="admin-ops-section__head">
          <div>
            <p className="admin-ops-section__kicker">Acceso rápido</p>
            <h2 className="admin-ops-section__title">Módulos del panel</h2>
          </div>
        </header>
        <div className="admin-ops-quicklinks">
          {QUICK_LINKS.map(link => (
            <Link key={link.to} to={link.to} className="admin-ops-quicklink">
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
