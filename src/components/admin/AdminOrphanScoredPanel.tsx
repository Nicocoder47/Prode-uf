import type { AdminOrphanScored } from '../../types/admin.ts'
import { PremiumButton } from '../ui/PremiumButton.tsx'

function formatDate(v: string | null | undefined) {
  if (!v) return '—'
  return new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function AdminOrphanScoredAlert({
  orphans,
  onViewCases,
  showCases,
}: {
  orphans: AdminOrphanScored
  onViewCases: () => void
  showCases: boolean
}) {
  if (orphans.count <= 0) return null

  return (
    <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 space-y-3">
      <p className="text-sm font-bold text-red-100">
        Se detectaron {orphans.count} predicción(es) puntuadas en partidos no finalizados.
      </p>
      <PremiumButton size="sm" variant="ghost" onClick={onViewCases}>
        {showCases ? 'Ocultar casos' : 'Ver casos'}
      </PremiumButton>
      {showCases && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-red-400/20 text-red-200/70">
                <th className="py-2 pr-2">Usuario</th>
                <th className="py-2 pr-2">Partido</th>
                <th className="py-2 pr-2">Estado partido</th>
                <th className="py-2 pr-2">Pts</th>
                <th className="py-2">Kick-off</th>
              </tr>
            </thead>
            <tbody>
              {orphans.cases.map(c => (
                <tr key={c.prediction_id} className="border-b border-red-400/10 text-red-50/90">
                  <td className="py-2 pr-2">{c.full_name ?? c.email ?? c.user_id}</td>
                  <td className="py-2 pr-2">{c.home_team ?? '?'} vs {c.away_team ?? '?'}</td>
                  <td className="py-2 pr-2 font-mono">{c.match_status}</td>
                  <td className="py-2 pr-2 font-bold">{c.points}</td>
                  <td className="py-2">{formatDate(c.kick_off)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
