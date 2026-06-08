import { Link } from 'react-router-dom'
import { Flame, Star, Trophy, TrendingUp } from 'lucide-react'
import { PremiumCard, StatsPill } from '../../components/ui/PremiumCard.tsx'
import { DataState } from '../../components/ui/DataState.tsx'
import { useAuth } from '../../lib/auth.tsx'
import { useLeaderboard, usePredictions, useWorldCupMatches } from '../../useWorldCupData.ts'

function formatNumber(value: number) {
  return value.toLocaleString('es-AR')
}

export default function ProfilePage() {
  const { profile, user } = useAuth()
  const { data: leaderboard = [], isLoading: leaderboardLoading } = useLeaderboard()
  const { data: predictions = [], isLoading: predictionsLoading } = usePredictions(user?.id)
  const { data: matches = [] } = useWorldCupMatches()

  const displayName = profile?.full_name ?? user?.email?.split('@')[0] ?? 'Jugador'
  const dni = profile?.dni ?? '—'
  const legajo = profile?.legajo ?? profile?.domain_plate ?? '—'
  const email = profile?.email ?? user?.email ?? ''
  const tokens = profile?.token_balance ?? 0

  const me = leaderboard.find(entry => entry.userId === user?.id)
  const scoredPredictions = predictions.filter(p => p.status === 'scored')
  const hits = scoredPredictions.filter(p => p.points > 0).length
  const totalPoints = me?.points ?? predictions.reduce((sum, p) => sum + (p.points ?? 0), 0)
  const accuracy =
    scoredPredictions.length > 0 ? Math.round((hits / scoredPredictions.length) * 100) : null

  const isLoading = leaderboardLoading || predictionsLoading

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-8 shadow-glassCard backdrop-blur-xl">
        <div className="absolute -right-32 -top-32 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[auto_1fr]">
          <div className="flex h-24 w-24 items-center justify-center rounded-[20px] bg-gradient-to-br from-cyan-500 to-violet-500 text-4xl font-black text-white">
            {(displayName.charAt(0) || 'J').toUpperCase()}
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold text-white">{displayName}</h1>
            <p className="text-sm text-slate-400">
              {email}
              {dni !== '—' ? ` · DNI ${dni}` : ''}
              {legajo !== '—' ? ` · Legajo ${legajo}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {me?.rank ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                  <Trophy className="h-4 w-4" /> #{me.rank} en el ranking
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                  <Trophy className="h-4 w-4" /> Sin posición aún
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200">
                <Star className="h-4 w-4" /> {formatNumber(totalPoints)} pts
              </span>
              {accuracy !== null ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <TrendingUp className="h-4 w-4" /> {accuracy}% precisión
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                  <Flame className="h-4 w-4" /> Sin partidos puntuados
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <DataState isLoading={isLoading} loadingMessage="Cargando tu perfil…">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <PremiumCard variant="elevated" title="Estadísticas de la temporada">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatsPill label="Puntos totales" value={formatNumber(totalPoints)} highlight icon="⭐" />
                <StatsPill label="Predicciones" value={formatNumber(predictions.length)} icon="🎯" />
                <StatsPill label="Aciertos" value={formatNumber(hits)} highlight icon="✓" />
              </div>
            </PremiumCard>

            <PremiumCard title="Actividad reciente" description="Tus últimas predicciones">
              {predictions.length === 0 ? (
                <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-400">
                  Todavía no hiciste predicciones.{' '}
                  <Link to="/matches" className="font-semibold text-cyan-300 hover:text-cyan-200">
                    Elegí un partido
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...predictions]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .slice(0, 5)
                    .map(prediction => {
                      const match = matches.find(m => m.id === prediction.matchId)
                      const label = match
                        ? `${match.homeTeam?.name ?? 'Local'} vs ${match.awayTeam?.name ?? 'Visitante'}`
                        : 'Partido'

                      return (
                        <div
                          key={prediction.id}
                          className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">{label}</p>
                            <p className="text-xs text-slate-400">
                              {prediction.status === 'scored'
                                ? `${prediction.points} pts`
                                : prediction.status === 'locked'
                                  ? 'Bloqueada'
                                  : 'Pendiente'}
                            </p>
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
                            {new Date(prediction.createdAt).toLocaleDateString('es-AR')}
                          </span>
                        </div>
                      )
                    })}
                </div>
              )}
            </PremiumCard>
          </div>

          <div className="space-y-6">
            <PremiumCard variant="premium" className="text-center">
              <div className="space-y-2">
                <Star className="mx-auto h-8 w-8 text-amber-400" />
                <p className="text-3xl font-bold text-white">
                  {me?.rank ? `#${me.rank}` : '—'}
                </p>
                <p className="text-sm text-slate-400">Posición global</p>
              </div>
            </PremiumCard>

            <PremiumCard variant="dark" title="Datos rápidos">
              <div className="space-y-2 text-sm text-slate-300">
                <p>✓ {formatNumber(predictions.length)} predicciones realizadas</p>
                <p>✓ {formatNumber(hits)} aciertos puntuados</p>
                <p>✓ {formatNumber(totalPoints)} puntos totales</p>
                <p>✓ {formatNumber(tokens)} tokens disponibles</p>
                {me ? (
                  <p>
                    ✓ {me.wins} exactas · {me.draws} empates · {me.losses} resultados
                  </p>
                ) : null}
              </div>
            </PremiumCard>

            <div className="grid gap-3">
              <Link
                to="/predictions"
                className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Ver mis predicciones
              </Link>
              <Link
                to="/leaderboard"
                className="rounded-[20px] border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
              >
                Ver ranking
              </Link>
            </div>
          </div>
        </div>
      </DataState>
    </div>
  )
}
