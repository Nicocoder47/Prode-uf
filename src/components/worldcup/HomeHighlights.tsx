import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crown, Star, Target, Trophy } from 'lucide-react'
import { MOTION } from '../../constants/design'
import { useAllPlayers, useLeaderboard, useWorldCupTeams } from '../../useWorldCupData'
import { TeamCrest } from './TeamCrest'
import { PlayerAvatar } from './PlayerAvatar'

type HighlightRowProps = {
  title: string
  icon: React.ReactNode
  to: string
  loading: boolean
  empty: boolean
  children: React.ReactNode
}

function HighlightRow({ title, icon, to, loading, empty, children }: HighlightRowProps) {
  if (loading) {
    return (
      <div className="mb-4 text-center text-xs text-wc26-text/45">Cargando {title.toLowerCase()}…</div>
    )
  }

  if (empty) return null

  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-wc26-text/55">
          {icon}
          {title}
        </p>
        <Link to={to} className="text-[10px] font-black text-[#0057B8]">
          Ver más
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">{children}</div>
    </div>
  )
}

export function HomeHighlights() {
  const { data: teams = [], isLoading: teamsLoading } = useWorldCupTeams()
  const { data: players = [], isLoading: playersLoading } = useAllPlayers()
  const { data: leaderboard = [], isLoading: rankLoading } = useLeaderboard()

  const loading = teamsLoading || playersLoading || rankLoading

  const topTeams = [...teams]
    .filter(t => t.fifaRanking != null)
    .sort((a, b) => (a.fifaRanking ?? 999) - (b.fifaRanking ?? 999))
    .slice(0, 6)

  const topPlayers = [...players]
    .filter(p => p.marketValue != null || p.rating != null)
    .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0) || (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 6)

  const topScorers = [...players]
    .filter(p => p.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 6)

  const topRank = leaderboard.slice(0, 6)

  const hasData =
    topTeams.length > 0 || topPlayers.length > 0 || topScorers.length > 0 || topRank.length > 0

  if (!loading && !hasData) {
    return (
      <p className="rounded-2xl bg-white/60 px-4 py-5 text-center text-sm text-wc26-text/55">
        Los destacados aparecerán cuando haya estadísticas disponibles.
      </p>
    )
  }

  return (
    <motion.div {...MOTION.enter} className="wc26-highlights wc26-highlights--embedded">
      <HighlightRow
        title="Top selecciones"
        icon={<Crown className="h-3.5 w-3.5 text-[#D4AF37]" />}
        to="/teams"
        loading={teamsLoading}
        empty={topTeams.length === 0}
      >
        {topTeams.map((team, idx) => (
          <motion.div key={team.id} whileTap={{ scale: 0.96 }}>
            <Link to={`/teams/${team.id}`} className="wc26-highlight-card shrink-0 w-[148px]">
              <TeamCrest flag={team.flag} code={team.code} size="md" />
              <span className="mt-2 truncate text-sm font-black text-wc26-text">{team.code}</span>
              <span className="text-[10px] font-bold text-wc26-text/45">#{team.fifaRanking} FIFA</span>
              {idx === 0 && <span className="wc26-highlight-badge">TOP</span>}
            </Link>
          </motion.div>
        ))}
      </HighlightRow>

      <HighlightRow
        title="Top jugadores"
        icon={<Star className="h-3.5 w-3.5 text-[#0057B8]" />}
        to="/players"
        loading={playersLoading}
        empty={topPlayers.length === 0}
      >
        {topPlayers.map(player => (
          <motion.div key={player.id} whileTap={{ scale: 0.96 }}>
            <Link to={`/players/${player.id}`} className="wc26-highlight-card shrink-0 w-[148px]">
              <PlayerAvatar
                photo={player.photo}
                photoUrl={player.photoUrl}
                name={player.name}
                size="md"
                position={player.position}
                nationality={player.nationality}
              />
              <span className="mt-2 line-clamp-2 text-center text-xs font-black leading-tight text-wc26-text">
                {player.name}
              </span>
              <span className="text-[10px] font-bold text-wc26-text/45">{player.club ?? player.position ?? '—'}</span>
            </Link>
          </motion.div>
        ))}
      </HighlightRow>

      <HighlightRow
        title="Máximos goleadores"
        icon={<Target className="h-3.5 w-3.5 text-[#EF233C]" />}
        to="/players"
        loading={playersLoading}
        empty={topScorers.length === 0}
      >
        {topScorers.map(player => (
          <motion.div key={player.id} whileTap={{ scale: 0.96 }}>
            <Link to={`/players/${player.id}`} className="wc26-highlight-card shrink-0 w-[148px]">
              <PlayerAvatar
                photo={player.photo}
                photoUrl={player.photoUrl}
                name={player.name}
                size="md"
                position={player.position}
              />
              <span className="mt-2 line-clamp-2 text-center text-xs font-black leading-tight text-wc26-text">
                {player.name}
              </span>
              <span className="text-sm font-black text-[#EF233C]">{player.goals} goles</span>
            </Link>
          </motion.div>
        ))}
      </HighlightRow>

      <HighlightRow
        title="Ranking general"
        icon={<Trophy className="h-3.5 w-3.5 text-[#006B3F]" />}
        to="/leaderboard"
        loading={rankLoading}
        empty={topRank.length === 0}
      >
        {topRank.map(entry => (
          <motion.div key={entry.userId} whileTap={{ scale: 0.96 }}>
            <Link to="/leaderboard" className="wc26-highlight-card shrink-0 w-[148px]">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#006B3F] to-[#12a058] text-sm font-black text-white shadow-md">
                #{entry.rank ?? '—'}
              </span>
              <span className="mt-2 line-clamp-2 text-center text-xs font-black leading-tight text-wc26-text">
                {entry.profile?.fullName ?? 'Usuario'}
              </span>
              <span className="text-sm font-black text-[#0057B8]">{entry.points} pts</span>
            </Link>
          </motion.div>
        ))}
      </HighlightRow>
    </motion.div>
  )
}
