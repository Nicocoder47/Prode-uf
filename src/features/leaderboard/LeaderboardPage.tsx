import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { FriendRanking } from '../../components/worldcup'
import { useLeaderboard } from '../../useWorldCupData'

export default function LeaderboardPage() {
  const { user } = useAuth()
  const { data: leaderboard = [], isLoading } = useLeaderboard()

  const users = leaderboard.map((lb, idx) => ({
    id: lb.userId,
    name: lb.profile?.fullName || 'Usuario',
    points: lb.points,
    position: lb.rank ?? idx + 1,
    change: 0,
    streak: lb.wins,
    avatar: (lb.profile?.fullName || 'U').charAt(0).toUpperCase(),
  }))

  const me = leaderboard.find(lb => lb.userId === user?.id)
  const leader = leaderboard[0]
  const gapToLeader = me && leader && me.userId !== leader.userId ? Math.max(0, leader.points - me.points) : null

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-wc26-blue">Ranking global</p>
        <h1 className="text-2xl font-extrabold text-wc26-text md:text-3xl">Leaderboard</h1>
      </div>

      {me && (
        <Link to="/profile" className="wc26-rank-snippet block">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-wc26-gold to-amber-600 text-xl font-black text-[#1a1200] shadow-lg">
              #{me.rank ?? '—'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/50">Tu posición</p>
              <p className="text-lg font-extrabold text-white">{me.points} puntos globales</p>
              {gapToLeader != null && gapToLeader > 0 ? (
                <p className="text-xs text-white/60">
                  {gapToLeader} pts por debajo del líder ({leader.profile?.fullName || 'Líder'})
                </p>
              ) : me.rank === 1 ? (
                <p className="text-xs font-bold text-emerald-300">Sos el líder del torneo</p>
              ) : (
                <p className="text-xs text-white/55">Competí en el próximo partido disponible</p>
              )}
            </div>
            <Trophy className="h-6 w-6 shrink-0 text-wc26-yellow" />
          </div>
        </Link>
      )}

      {isLoading && <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">Cargando ranking...</p>}

      {!isLoading && users.length === 0 && (
        <p className="wc26-card p-5 text-center text-sm text-wc26-text/55">
          El ranking se activará cuando se puntúen las primeras predicciones.
        </p>
      )}

      {!isLoading && users.length > 0 && (
        <FriendRanking users={users} currentUserId={user?.id ?? ''} maxShow={10} title="Top 10" />
      )}
    </div>
  )
}
