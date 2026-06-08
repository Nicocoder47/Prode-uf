import { motion } from 'framer-motion'
import { Flame, Star, Trophy, TrendingUp } from 'lucide-react'
import { PremiumCard, StatsPill } from '../../components/ui/PremiumCard.tsx'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { useAuth } from '../../lib/auth.tsx'

const achievements = [
  { id: 1, name: 'First Prediction', description: 'Realiza tu primera predicción', icon: '🎯', unlocked: true },
  { id: 2, name: 'Streak 5', description: 'Racha de 5 aciertos consecutivos', icon: '🔥', unlocked: true },
  { id: 3, name: 'Perfect Combo', description: 'Acertá todas las predicciones en un partido', icon: '💯', unlocked: true },
  { id: 4, name: 'Top 3', description: 'Llegar al top 3 del leaderboard', icon: '🏆', unlocked: false },
  { id: 5, name: 'Token Master', description: 'Invertir 1000+ tokens en una semana', icon: '💰', unlocked: false },
  { id: 6, name: 'MVP Scout', description: 'Acertar 10 MVPs', icon: '⭐', unlocked: false },
]

const recentMatches = [
  { opponent: 'Luna', result: '✓ Ganaste 280 pts', date: 'Hace 2h' },
  { opponent: 'Mati', result: '✗ Perdiste 120 pts', date: 'Hace 1d' },
  { opponent: 'Isa', result: '✓ Ganaste 420 pts', date: 'Hace 3d' },
]

export default function ProfilePage() {
  const { profile, user } = useAuth()
  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'Jugador'
  const dni = profile?.dni ?? '—'
  const legajo = profile?.legajo ?? profile?.domain_plate ?? '—'
  const email = profile?.email ?? user?.email ?? ''

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-glassCard backdrop-blur-xl"
      >
        <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[auto_1fr_auto]">
          <div className="flex h-24 w-24 items-center justify-center rounded-[20px] bg-gradient-to-br from-cyan-500 to-violet-500 text-4xl">
            🎮
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white">{displayName}</h1>
            <p className="text-sm text-slate-400">
              {email}
              {dni !== '—' ? ` · DNI ${dni}` : ''}
              {legajo !== '—' ? ` · Legajo ${legajo}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200">
                <Flame className="h-4 w-4" /> Racha 12d
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                <Trophy className="h-4 w-4" /> 35 victorias
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                <TrendingUp className="h-4 w-4" /> 66.7% precisión
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <PremiumButton variant="primary" size="md">
              Editar perfil
            </PremiumButton>
            <PremiumButton variant="secondary" size="md">
              Compartir
            </PremiumButton>
          </div>
        </div>
      </motion.div>

      {/* MAIN GRID */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: Stats */}
        <div className="space-y-6 lg:col-span-2">
          <PremiumCard variant="elevated" title="Estadísticas de la temporada">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatsPill label="Puntos totales" value="2.880" highlight icon="⭐" />
              <StatsPill label="Predicciones" value="148" icon="🎯" />
              <StatsPill label="Aciertos" value="99" change={12} highlight icon="✓" />
              <StatsPill label="Ganancia neta" value="$ 85.200 ARS" change={15} icon="💰" />
            </div>
          </PremiumCard>

          <PremiumCard title="Rendimiento semanal" description="Últimos 7 días">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Lunes</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-900">
                    <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600" />
                  </div>
                  <span className="text-sm font-semibold text-cyan-200">420 pts</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Martes</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-900">
                    <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600" />
                  </div>
                  <span className="text-sm font-semibold text-emerald-200">560 pts</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Miércoles</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-slate-900">
                    <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600" />
                  </div>
                  <span className="text-sm font-semibold text-red-200">0 pts</span>
                </div>
              </div>
            </div>
          </PremiumCard>

          <PremiumCard title="Enfrentamientos recientes">
            <div className="space-y-3">
              {recentMatches.map((match, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">vs {match.opponent}</p>
                    <p className="text-xs text-slate-400">{match.date}</p>
                  </div>
                  <span className={match.result.includes('Ganaste') ? 'text-emerald-300' : 'text-red-300'}>{match.result}</span>
                </motion.div>
              ))}
            </div>
          </PremiumCard>
        </div>

        {/* RIGHT: Achievements + Level */}
        <div className="space-y-6">
          <PremiumCard variant="premium" className="text-center">
            <div className="space-y-2">
              <Star className="mx-auto h-8 w-8 text-amber-400" />
              <p className="text-3xl font-bold text-white">Nivel 8</p>
              <p className="text-sm text-slate-400">320/500 XP para Nivel 9</p>
              <div className="mt-3 h-2 rounded-full bg-slate-900">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
              </div>
            </div>
          </PremiumCard>

          <PremiumCard title="Logros desbloqueados">
            <div className="grid grid-cols-2 gap-3">
              {achievements.map(achievement => (
                <motion.div
                  key={achievement.id}
                  whileHover={achievement.unlocked ? { scale: 1.05 } : {}}
                  className={`rounded-[16px] p-3 text-center transition-all ${
                    achievement.unlocked
                      ? 'border border-cyan-500/30 bg-cyan-500/10'
                      : 'border border-white/5 bg-white/5 opacity-50'
                  }`}
                >
                  <p className="text-2xl">{achievement.icon}</p>
                  <p className="mt-1 text-xs font-semibold text-white">{achievement.name}</p>
                </motion.div>
              ))}
            </div>
          </PremiumCard>

          <PremiumCard variant="dark" title="Datos rápidos">
            <div className="space-y-2 text-sm text-slate-300">
              <p>✓ 148 predicciones realizadas</p>
              <p>✓ 12 rachas más largas</p>
              <p>✓ 1 combo perfecto</p>
              <p>✓ $ 85K ganados netos</p>
            </div>
          </PremiumCard>
        </div>
      </div>
    </div>
  )
}
