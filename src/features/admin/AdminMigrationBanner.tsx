import { PUBLIC_DEMO_ACCESS } from '../../config/publicAccess'
import { useAdminRpcMode } from '../../hooks/useAdminQueries'

export function AdminMigrationBanner() {
  const { data: mode } = useAdminRpcMode()

  return (
    <>
      {PUBLIC_DEMO_ACCESS && (
        <div className="admin-migration-banner border-red-400/40 bg-red-500/15 text-red-100">
          <strong>Modo demo activo.</strong> El panel admin no valida rol en este entorno. Desactivar{' '}
          <code>VITE_PUBLIC_DEMO</code> en producción.
        </div>
      )}
      {mode === 'fallback' && (
        <div className="admin-migration-banner">
          <strong>Modo básico activo.</strong> Usuarios y KPIs funcionan. Para activity logs, notificaciones y
          cards completas, aplicá la migración SQL con <code>npm run db:push:cloud</code>.
        </div>
      )}
    </>
  )
}
