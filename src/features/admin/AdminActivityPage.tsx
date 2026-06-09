import { useState } from 'react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { useAdminActivityLogs, type AdminActivityFilters } from '../../hooks/useAdminQueries.ts'
import type { ActivityLogType, AdminActivityRow } from '../../types/admin.ts'

const ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'user_registered', label: 'Registro' },
  { value: 'user_login', label: 'Login' },
  { value: 'prediction_created', label: 'Predicción creada' },
  { value: 'prediction_updated', label: 'Predicción editada' },
  { value: 'user_blocked', label: 'Bloqueo' },
  { value: 'user_unblocked', label: 'Desbloqueo' },
  { value: 'user_rejected', label: 'Rechazado' },
  { value: 'user_manually_approved', label: 'Aprobado manual' },
  { value: 'user_deleted', label: 'Eliminación' },
  { value: 'notification_created', label: 'Notificación' },
  { value: 'notification_read', label: 'Notif. leída' },
  { value: 'admin_card_updated', label: 'Card actualizada' },
  { value: 'admin_role_changed', label: 'Rol admin' },
  { value: 'score_calculated', label: 'Scoring' },
  { value: 'sync_completed', label: 'Sync OK' },
  { value: 'sync_failed', label: 'Sync fallido' },
]

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminActivityPage() {
  const [type, setType] = useState('')
  const [legajo, setLegajo] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [appliedFilters, setAppliedFilters] = useState<AdminActivityFilters>({ limit: 200 })

  const { data: logs = [], isLoading } = useAdminActivityLogs(appliedFilters)

  function applyFilters() {
    setAppliedFilters({
      type: type || undefined,
      legajo: legajo || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      limit: 200,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Auditoría</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Actividad</h2>
      </div>

      <PremiumCard title="Filtros">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            {ACTIVITY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Legajo"
            value={legajo}
            onChange={e => setLegajo(e.target.value)}
          />
          <input
            type="datetime-local"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={from}
            onChange={e => setFrom(e.target.value)}
          />
          <input
            type="datetime-local"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={to}
            onChange={e => setTo(e.target.value)}
          />
          <PremiumButton size="sm" onClick={applyFilters}>Filtrar</PremiumButton>
        </div>
      </PremiumCard>

      <PremiumCard title="Movimientos" description={`${logs.length} registros`}>
        {isLoading ? (
          <p className="text-white/60">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-white/50">
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Usuario</th>
                  <th className="py-2 pr-3">Legajo</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Descripción</th>
                  <th className="py-2">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: AdminActivityRow) => (
                  <tr key={log.id} className="border-b border-white/5 align-top">
                    <td className="py-2 pr-3 text-xs text-white/50">{formatDate(log.created_at)}</td>
                    <td className="py-2 pr-3 text-white">{log.user_name ?? log.full_name ?? '—'}</td>
                    <td className="py-2 pr-3 text-white/70">{log.user_legajo ?? log.legajo ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase">
                        {log.type as ActivityLogType}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-white/80">{log.description ?? log.title}</td>
                    <td className="py-2 max-w-[200px] truncate text-xs text-white/40">
                      {JSON.stringify(log.metadata ?? {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PremiumCard>
    </div>
  )
}
