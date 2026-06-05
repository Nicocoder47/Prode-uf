import { CreditCard, ShieldCheck } from 'lucide-react'
import { GlassCard } from '../../components/ui/GlassCard.tsx'

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <GlassCard title="Pagos y tokens" description="Modo automático y manual">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-black/10 p-6">
            <div className="flex items-center gap-3 text-cyan-200">
              <CreditCard className="h-5 w-5" />
              <p className="text-sm uppercase tracking-[0.32em] text-slate-400">Modo automático</p>
            </div>
            <p className="mt-4 text-slate-300">Integración con Mercado Pago, webhooks y acreditación automática de tokens.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/10 p-6">
            <div className="flex items-center gap-3 text-cyan-200">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm uppercase tracking-[0.32em] text-slate-400">Modo manual</p>
            </div>
            <p className="mt-4 text-slate-300">Transferencias bancarias, comprobante en subida y aprobación manual del admin.</p>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
