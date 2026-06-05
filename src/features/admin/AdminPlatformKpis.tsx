import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Target, Users, Zap } from 'lucide-react'
import { PremiumCard } from '../../components/ui/PremiumCard.tsx'
import { adminFetch } from '../../lib/adminApi'

type AuditReport = {
  counts: { pending: number; locked: number; scored: number; total: number }
  platform: {
    totalUsers: number
    totalMatches: number
    finishedMatches: number
    liveMatches: number
    scoredMatches: number
    pendingScoringMatches: number
  }
}

export default function AdminPlatformKpis() {
  const [report, setReport] = useState<AuditReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch('/api/admin/predictions/audit')
      if (res.ok) setReport(await res.json())
    } catch {
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const users = report?.platform.totalUsers ?? '—'
  const predictions = report?.counts.total ?? '—'
  const matches = report?.platform.totalMatches ?? '—'
  const scored = report?.counts.scored ?? '—'
  const pending = report?.counts.pending ?? '—'
  const live = report?.platform.liveMatches ?? '—'

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <PremiumCard variant="premium">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-slate-400">Usuarios</p>
            <p className="mt-2 text-3xl font-bold text-white">{loading ? '…' : users}</p>
          </div>
          <Users className="h-8 w-8 text-cyan-400" />
        </div>
      </PremiumCard>
      <PremiumCard variant="premium">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-slate-400">Predicciones</p>
            <p className="mt-2 text-3xl font-bold text-green-400">{loading ? '…' : predictions}</p>
            <p className="mt-1 text-[10px] text-slate-500">{pending} pendientes · {scored} puntuadas</p>
          </div>
          <Zap className="h-8 w-8 text-green-400" />
        </div>
      </PremiumCard>
      <PremiumCard variant="premium">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-slate-400">Partidos</p>
            <p className="mt-2 text-3xl font-bold text-sky-300">{loading ? '…' : matches}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              {report?.platform.pendingScoringMatches ?? 0} sin scoring
            </p>
          </div>
          <Calendar className="h-8 w-8 text-sky-400" />
        </div>
      </PremiumCard>
      <PremiumCard variant="premium">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-slate-400">En vivo</p>
            <p className="mt-2 text-3xl font-bold text-red-400">{loading ? '…' : live}</p>
            <p className="mt-1 text-[10px] text-slate-500">{report?.platform.scoredMatches ?? 0} partidos puntuados</p>
          </div>
          <Target className="h-8 w-8 text-amber-400" />
        </div>
      </PremiumCard>
    </motion.div>
  )
}
