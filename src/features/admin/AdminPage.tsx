import { ShieldCheck } from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard.tsx'

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-[36px] border border-white/10 bg-white/5 p-8 shadow-glass backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Admin operations</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Centro de control</h1>
        <p className="mt-4 max-w-2xl text-slate-300">Monitorea usuarios, pagos, eventos del scraper y ejecuciones del scoring engine.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-3">
        <GlassCard title="Estado de APIs" description="Health checks y latencia">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            <span>Mercado Pago, API-Football y scrapers en tiempo real.</span>
          </div>
        </GlassCard>
        <GlassCard title="Pagos en cola" description="Aprobación urgente">
          <p className="text-slate-300">Verifica transferencias manuales y acredita tokens en segundos.</p>
        </GlassCard>
        <GlassCard title="Logs de auditoría" description="Eventos críticos">
          <p className="text-slate-300">RLS, auth y thresholds de seguridad bajo supervisión.</p>
        </GlassCard>
      </div>
    </div>
  )
}
