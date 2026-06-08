import { Link, useNavigate } from 'react-router-dom'
import { Flame, LogOut, Star, Trophy, TrendingUp } from 'lucide-react'
import { PremiumCard, StatsPill } from '../../components/ui/PremiumCard.tsx'
import { DataState } from '../../components/ui/DataState.tsx'
import { useAuth } from '../../lib/auth.tsx'
import { useLeaderboard, usePredictions, useWorldCupMatches } from '../../useWorldCupData.ts'

function formatNumber(value: number) {
  return value.toLocaleString('es-AR')
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first: parts[0] ?? 'Jugador', last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { profile, user, signOut } = useAuth()
  const { data: leaderboard = [], isLoading: leaderboardLoading } = useLeaderboard()
  const { data: predictions = [], isLoading: predictionsLoading } = usePredictions(user?.id)
  const { data: matches = [] } = useWorldCupMatches()

  const fullName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Jugador'
  const { first, last } = splitName(fullName)
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

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-6">
      <section className="wc26-profile-rank-card">
        <div className="wc26-profile-rank-card__glow" aria-hidden="true" />

        <div className="wc26-profile-rank-card__top">
          {me?.rank ? (
            <span className="wc26-profile-rank-card__rank-badge">
              <Trophy className="h-4 w-4" />
              #{me.rank} en el ranking
            </span>
          ) : (
            <span className="wc26-profile-rank-card__rank-badge wc26-profile-rank-card__rank-badge--muted">
              <Trophy className="h-4 w-4" />
              Sin posición aún
            </span>
          )}
        </div>

        <div className="wc26-profile-rank-card__stats">
          <div className="wc26-profile-rank-card__stat wc26-profile-rank-card__stat--legajo">
            <p className="wc26-profile-rank-card__label">Legajo</p>
            <p className="wc26-profile-rank-card__legajo">{legajo}</p>
          </div>

          <div className="wc26-profile-rank-card__stat wc26-profile-rank-card__stat--name">
            <p className="wc26-profile-rank-card__label">Nombre completo</p>
            <p className="wc26-profile-rank-card__name">{first}</p>
            {last ? <p className="wc26-profile-rank-card__lastname">{last}</p> : null}
          </div>

          <div className="wc26-profile-rank-card__stat wc26-profile-rank-card__stat--points">
            <p className="wc26-profile-rank-card__label">Puntos</p>
            <p className="wc26-profile-rank-card__points">
              {formatNumber(totalPoints)}
              <span className="wc26-profile-rank-card__points-unit">pts</span>
            </p>
          </div>
        </div>

        <div className="wc26-profile-rank-card__meta">
          {email ? <span>{email}</span> : null}
          {dni !== '—' ? <span>DNI {dni}</span> : null}
        </div>

        <div className="wc26-profile-rank-card__chips">
          {accuracy !== null ? (
            <span className="wc26-profile-rank-card__chip wc26-profile-rank-card__chip--ok">
              <TrendingUp className="h-3.5 w-3.5" /> {accuracy}% precisión
            </span>
          ) : (
            <span className="wc26-profile-rank-card__chip">
              <Flame className="h-3.5 w-3.5" /> Sin partidos puntuados
            </span>
          )}
          <span className="wc26-profile-rank-card__chip">
            <Star className="h-3.5 w-3.5" /> {formatNumber(tokens)} tokens
          </span>
        </div>
      </section>

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
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="wc26-profile-logout"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </DataState>
    </div>
  )
}
