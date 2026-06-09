import { PremiumCard, StatsPill } from '../../components/ui/PremiumCard.tsx'
import { useAdminDashboard } from '../../hooks/useAdminQueries.ts'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AdminDashboardPage() {
  const { data, error, isLoading } = useAdminDashboard()

  if (isLoading) {
    return <p className="text-white/70">Cargando panel…</p>
  }

  if (error || !data) {
    return (
      <PremiumCard variant="dark" title="Error">
        <p className="text-red-300">{error instanceof Error ? error.message : 'Sin datos'}</p>
      </PremiumCard>
    )
  }

  const userKpis = [
    { label: 'Usuarios totales', value: data.total_users },
    { label: 'Activos', value: data.active_users, highlight: true },
    { label: 'Bloqueados', value: data.blocked_users },
    { label: 'Eliminados', value: data.deleted_users },
    { label: 'Verificados', value: data.users_verified ?? 0 },
    { label: 'En revisión', value: data.users_review_required ?? 0 },
    { label: 'Aprob. manual', value: data.users_manually_approved ?? 0 },
    { label: 'Rechazados', value: data.users_rejected ?? 0 },
  ]

  const gameKpis = [
    { label: 'Predicciones', value: data.total_predictions },
    { label: 'Sin predicciones', value: data.users_without_predictions ?? 0 },
    { label: 'Scheduled', value: data.scheduled_matches },
    { label: 'En vivo', value: data.live_matches, highlight: true },
    { label: 'Finalizados', value: data.finished_matches },
    { label: 'Logins hoy', value: data.today_logins },
    { label: 'Registros hoy', value: data.today_registrations },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">Resumen</p>
        <h2 className="text-xl font-extrabold text-white md:text-2xl">Dashboard</h2>
      </div>

      <PremiumCard title="Usuarios" description="KPIs de cuentas y revisión">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {userKpis.map(kpi => (
            <StatsPill key={kpi.label} label={kpi.label} value={String(kpi.value)} highlight={kpi.highlight} />
          ))}
        </div>
      </PremiumCard>

      <PremiumCard title="Juego y sync" description="Predicciones, partidos y actividad del día">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {gameKpis.map(kpi => (
            <StatsPill key={kpi.label} label={kpi.label} value={String(kpi.value)} highlight={kpi.highlight} />
          ))}
        </div>
      </PremiumCard>

      {(data.users_review_required ?? 0) > 0 && (
        <PremiumCard title="Usuarios que requieren revisión" description="DNI no encontrado en padrón — requiere decisión del admin">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-white/50">
                  <th className="py-2 pr-3">Legajo</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">DNI</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Alta</th>
                  <th className="py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {data.review_required_users?.map(u => (
                  <tr key={u.id} className="admin-user-row--review border-b border-red-400/10">
                    <td className="py-2 pr-3 font-semibold text-white">{u.legajo ?? '—'}</td>
                    <td className="py-2 pr-3 text-white">{u.full_name}</td>
                    <td className="py-2 pr-3 font-mono text-red-200">{u.dni ?? '—'}</td>
                    <td className="py-2 pr-3 text-white/70">{u.email}</td>
                    <td className="py-2 pr-3 text-xs text-white/50">{formatDate(u.created_at)}</td>
                    <td className="py-2 text-xs text-red-200">{u.review_reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>
      )}

      {data.admin_cards?.length > 0 && (
        <PremiumCard title="Cards activas" description="Valores visibles en la app">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.admin_cards.map(card => (
              <div key={card.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{card.key}</p>
                <p className="mt-1 text-lg font-extrabold text-white">{card.value ?? '—'}</p>
                <p className="text-sm font-semibold text-white/80">{card.title}</p>
                {card.subtitle && <p className="text-xs text-white/50">{card.subtitle}</p>}
              </div>
            ))}
          </div>
        </PremiumCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PremiumCard title="Últimos registros" description="Altas recientes">
          <div className="space-y-2">
            {data.latest_registrations?.length ? (
              data.latest_registrations.map(u => (
                <div key={u.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-white">{u.full_name}</p>
                    <p className="text-xs text-white/50">{u.legajo} · {u.email}</p>
                  </div>
                  <span className="text-xs text-white/40">{formatDate(u.created_at)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/50">Sin registros</p>
            )}
          </div>
        </PremiumCard>

        <PremiumCard title="Últimos logins" description="Accesos recientes">
          <div className="space-y-2">
            {data.latest_logins?.length ? (
              data.latest_logins.map(u => (
                <div key={u.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-white">{u.full_name}</p>
                    <p className="text-xs text-white/50">{u.legajo}</p>
                  </div>
                  <span className="text-xs text-white/40">{formatDate(u.last_login_at)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/50">Sin logins</p>
            )}
          </div>
        </PremiumCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PremiumCard title="Top 10 ranking" description="Puntos acumulados (periodo global)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-white/50">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Legajo</th>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2">Pts</th>
                </tr>
              </thead>
              <tbody>
                {data.top_10_ranking?.map(row => (
                  <tr key={row.user_id} className="border-b border-white/5">
                    <td className="py-2 pr-3 font-bold text-wc26-yellow">{row.rank}</td>
                    <td className="py-2 pr-3 text-white/80">{row.legajo ?? '—'}</td>
                    <td className="py-2 pr-3 text-white">{row.full_name}</td>
                    <td className="py-2 font-extrabold text-white">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>

        <PremiumCard title="Próximos partidos" description="Partidos scheduled">
          <div className="space-y-2">
            {data.upcoming_matches?.length ? (
              data.upcoming_matches.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-white">{m.group_label ?? m.phase ?? 'Partido'}</p>
                    <p className="text-xs text-white/50">{m.status}</p>
                  </div>
                  <span className="text-xs text-white/40">{formatDate(m.kick_off)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/50">Sin partidos próximos</p>
            )}
          </div>
        </PremiumCard>
      </div>

      <PremiumCard title="Último sync" description="GitHub Actions / data sync">
        {data.last_sync ? (
          <div className="space-y-1 text-sm">
            <p><span className="text-white/50">Estado:</span> <strong className="text-white">{data.last_sync.status}</strong></p>
            <p><span className="text-white/50">Tipo:</span> {data.last_sync.sync_type} ({data.last_sync.provider})</p>
            <p><span className="text-white/50">Registros:</span> {data.last_sync.records_upserted}</p>
            <p><span className="text-white/50">Inicio:</span> {formatDate(data.last_sync.started_at)}</p>
            {data.last_sync.error_message && (
              <p className="text-red-300">{data.last_sync.error_message}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/50">Sin registros de sync</p>
        )}
      </PremiumCard>

      <PremiumCard title="Movimientos recientes" description="Activity logs">
        <div className="space-y-2">
          {data.latest_activity_logs?.length ? (
            data.latest_activity_logs.map(log => (
              <div key={log.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-white">{log.title}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-wc26-yellow">{log.type}</span>
                </div>
                <p className="text-xs text-white/50">
                  {log.full_name ?? log.legajo ?? '—'} · {formatDate(log.created_at)}
                </p>
                {log.description && <p className="mt-1 text-xs text-white/70">{log.description}</p>}
              </div>
            ))
          ) : (
            <p className="text-sm text-white/50">Sin movimientos</p>
          )}
        </div>
      </PremiumCard>
    </div>
  )
}
