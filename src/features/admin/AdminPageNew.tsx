/** @deprecated Admin V2 legacy — no enrutado. Links a /admin/data-quality y /admin/knockout rotos. */
import { Link } from 'react-router-dom'
import { AlertCircle, BarChart3, CheckCircle, Clock, Settings, Zap } from 'lucide-react'
import { PremiumCard, StatsPill } from '../../components/ui/PremiumCard.tsx'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { triggerSync } from '../../lib/queries/admin'
import PredictionsAuditPanel from './PredictionsAuditPanel.tsx'
import AdminPlatformKpis from './AdminPlatformKpis.tsx'

const SYNC_BASE = import.meta.env.VITE_SYNC_API_BASE_URL || ''

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <Link
        to="/admin/data-quality"
        className="block rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-200 hover:bg-amber-400/15"
      >
        Calidad de datos de jugadores → /admin/data-quality
      </Link>
      <Link
        to="/admin/knockout"
        className="block rounded-2xl border border-violet-400/30 bg-violet-400/10 p-4 text-sm font-bold text-violet-200 hover:bg-violet-400/15"
      >
        Knockout automático (clasificados y cruces) → /admin/knockout
      </Link>
      <Link
        to="/admin/system"
        className="block rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200 hover:bg-emerald-400/15"
      >
        Operación Mundial (live, sync, eventos) → /admin/system
      </Link>

      <PremiumCard title="Auditoría de Predicciones" description="Estado real del motor de scoring">
        <PredictionsAuditPanel />
      </PremiumCard>

      <AdminPlatformKpis />

      {/* MAIN GRID */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT */}
        <div className="space-y-6 lg:col-span-2">
          {/* Health Check */}
          <PremiumCard title="Estado de sistemas" description="Health checks en vivo">
            <div className="space-y-3">
              {[
                { name: 'Supabase', status: 'healthy', latency: '42ms' },
                { name: 'Sync API', status: SYNC_BASE ? 'healthy' : 'unknown', latency: SYNC_BASE ? '120ms' : '—' },
                { name: 'Mercado Pago', status: 'healthy', latency: '95ms' },
                { name: 'Scraper', status: 'warning', latency: 'Error' },
              ].map(service => (
                <div key={service.name} className="flex items-center justify-between rounded-[16px] border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${service.status === 'healthy' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`} />
                    <span className="text-sm font-semibold text-white">{service.name}</span>
                  </div>
                  <span className={`text-xs font-semibold ${service.status === 'healthy' ? 'text-green-300' : 'text-yellow-300'}`}>
                    {service.latency}
                  </span>
                </div>
              ))}
            </div>
          </PremiumCard>

          {/* Payments pending */}
          <PremiumCard title="Pagos en cola" description="Esperando aprobación manual">
            <div className="space-y-3">
              {[
                { user: 'Juan Pérez', amount: '$50.000 ARS', method: 'Transferencia', time: 'Hace 1h' },
                { user: 'María López', amount: '$100.000 ARS', method: 'Mercado Pago', time: 'Hace 3h' },
              ].map(payment => (
                <div key={payment.user} className="rounded-[16px] border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{payment.user}</p>
                      <p className="text-xs text-slate-400">{payment.method} • {payment.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-amber-200">{payment.amount}</p>
                      <div className="mt-2 flex gap-2">
                        <PremiumButton variant="success" size="sm">
                          <CheckCircle className="h-4 w-4" />
                        </PremiumButton>
                        <PremiumButton variant="danger" size="sm">
                          <AlertCircle className="h-4 w-4" />
                        </PremiumButton>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>

          {/* Scoring logs */}
          <PremiumCard title="Logs de scoring" description="Últimas ejecuciones">
            <div className="space-y-2 text-sm font-mono text-slate-400">
              <p className="text-emerald-300">✓ [02:45:32] Scoring completado: BRA 2-1 ARG (48 usuarios)</p>
              <p className="text-emerald-300">✓ [01:20:15] Leaderboard actualizado</p>
              <p className="text-yellow-300">⚠ [00:58:44] Reintentando webhook Mercado Pago (intento 2/3)</p>
              <p className="text-emerald-300">✓ [00:12:09] Notificaciones WhatsApp enviadas (1.240 msgs)</p>
              <div className="mt-3">
                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-worldCupBlue px-3 py-2 text-sm font-semibold text-white"
                  onClick={async () => {
                    await triggerSync('fixtures')
                    if (SYNC_BASE) await fetch(`${SYNC_BASE}/sync-fixtures`, { method: 'POST' })
                    alert('Sync fixtures requested')
                  }}
                >
                  Sincronizar fixture
                </button>
                <button
                  className="ml-3 inline-flex items-center gap-2 rounded-2xl bg-worldCupGreen px-3 py-2 text-sm font-semibold text-white"
                  onClick={async () => {
                    await triggerSync('teams')
                    if (SYNC_BASE) await fetch(`${SYNC_BASE}/sync-teams`, { method: 'POST' })
                    alert('Sync teams requested')
                  }}
                >
                  Sincronizar equipos
                </button>
                <button
                  className="ml-3 inline-flex items-center gap-2 rounded-2xl bg-worldCupBlue px-3 py-2 text-sm font-semibold text-white"
                  onClick={async () => {
                    await triggerSync('rosters')
                    if (SYNC_BASE) await fetch(`${SYNC_BASE}/sync-rosters`, { method: 'POST' })
                    alert('Sync rosters requested')
                  }}
                >
                  Sincronizar planteles
                </button>
                <button
                  className="ml-3 inline-flex items-center gap-2 rounded-2xl bg-worldCupRed px-3 py-2 text-sm font-semibold text-white"
                  onClick={async () => {
                    await triggerSync('lineups')
                    if (SYNC_BASE) await fetch(`${SYNC_BASE}/sync-lineups`, { method: 'POST' })
                    alert('Sync lineups requested')
                  }}
                >
                  Sincronizar alineaciones
                </button>
                <button
                  className="ml-3 inline-flex items-center gap-2 rounded-2xl bg-worldCupRed/80 px-3 py-2 text-sm font-semibold text-white"
                  onClick={async () => {
                    await triggerSync('availability')
                    if (SYNC_BASE) await fetch(`${SYNC_BASE}/sync-player-availability`, { method: 'POST' })
                    alert('Sync availability requested')
                  }}
                >
                  Sincronizar lesiones
                </button>
              </div>
            </div>
          </PremiumCard>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* Control Panel */}
          <PremiumCard title="Panel de control" description="Acciones críticas">
            <div className="space-y-3">
              <PremiumButton variant="secondary" className="w-full justify-start" size="md">
                <Settings className="h-4 w-4" />
                Forzar scoring
              </PremiumButton>
              <PremiumButton variant="secondary" className="w-full justify-start" size="md">
                <Clock className="h-4 w-4" />
                Cambiar MVP
              </PremiumButton>
              <PremiumButton variant="secondary" className="w-full justify-start" size="md">
                <BarChart3 className="h-4 w-4" />
                Recalcular ranking
              </PremiumButton>
              <PremiumButton variant="secondary" className="w-full justify-start" size="md">
                <Zap className="h-4 w-4" />
                Ejecutar cron manual
              </PremiumButton>
            </div>
          </PremiumCard>

          {/* Statistics */}
          <PremiumCard variant="elevated" title="Estadísticas">
            <div className="space-y-3">
              <StatsPill label="Tasa conversión" value="28.4%" highlight icon="📊" />
              <StatsPill label="ARPU" value="$1.840 ARS" icon="💰" />
              <StatsPill label="Tasa retención" value="87.3%" change={5} icon="📈" />
            </div>
          </PremiumCard>

          {/* Alerts */}
          <PremiumCard variant="dark" title="Alertas activas">
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2 text-amber-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>API-Football cerca del límite (850/900)</span>
              </div>
              <div className="flex items-start gap-2 text-emerald-300">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>BD bajo 80% capacidad</span>
              </div>
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  )
}
