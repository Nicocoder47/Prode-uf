import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { PlayerAvatar } from '../worldcup/PlayerAvatar'
import { PlayerCardFallback } from './PlayerCardFallback'
import { TeamCrest } from '../worldcup/TeamCrest'
import { resolvePlayerPhoto } from '../../utils/playerPhoto'
import type { Player } from '../../types/worldcup'
import { fmtMarketCompact } from '../../utils/teamAnalytics'

type PlayerHeroCardProps = {
  player: Player
  rating: number | null
  marketValue: number | null
  recentForm?: string | null
}

export function PlayerHeroCard({ player, rating, marketValue, recentForm }: PlayerHeroCardProps) {
  const ratingTier = rating != null && rating >= 7.5 ? '' : 'silver'
  const market = fmtMarketCompact(marketValue)
  const hasPhoto = !!resolvePlayerPhoto({ photo: player.photo, photoUrl: player.photoUrl })

  return (
    <motion.header {...MOTION.enterScale} className="wc26-player-hero">
      <div className="relative px-5 pb-5 pt-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="wc26-chip text-sm font-black">
              {player.shirtNumber != null ? `#${player.shirtNumber}` : 'SD —'}
            </span>
            <span className="wc26-chip text-[11px]">{player.position || 'Pos. —'}</span>
            {player.nationality && <span className="wc26-chip text-[11px]">{player.nationality}</span>}
          </div>
          <div className={`wc26-rating-badge ${ratingTier}`}>
            {rating != null && rating > 0 ? rating.toFixed(1) : '—'}
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div className="relative shrink-0">
            {hasPhoto ? (
              <PlayerAvatar
                photo={player.photo}
                photoUrl={player.photoUrl}
                name={player.name}
                size="hero"
                shirtNumber={player.shirtNumber}
                position={player.position}
                nationality={player.nationality}
                flagUrl={player.team?.flag}
                verified={player.verificationStatus === 'verified'}
              />
            ) : (
              <PlayerCardFallback
                name={player.name}
                shirtNumber={player.shirtNumber}
                position={player.position}
                nationality={player.nationality}
                flagUrl={player.team?.flag}
                teamCode={player.team?.code}
                size="hero"
              />
            )}
            {player.team && (
              <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 shadow-lg ring-2 ring-white/80">
                <TeamCrest flag={player.team.flag} code={player.team.code} size="sm" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <h1 className="truncate text-2xl font-black leading-tight text-white">{player.name}</h1>
            {player.team && (
              <Link to={`/teams/${player.teamId}`} className="mt-1 block truncate text-sm font-bold text-white/80">
                {player.team.name}
              </Link>
            )}
            {player.club ? (
              <p className="mt-0.5 truncate text-xs font-semibold text-white/60">{player.club}</p>
            ) : (
              <p className="mt-0.5 truncate text-xs font-semibold italic text-white/35">Club pendiente de verificación</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {market ? (
                <span className="wc26-chip bg-wc26-fifaYellow/20 text-wc26-fifaYellow">{market}</span>
              ) : (
                <span className="wc26-chip text-[11px] text-white/40">Valor no verificado</span>
              )}
              {player.height && <span className="wc26-chip text-[11px]">{player.height} cm</span>}
              {player.preferredFoot && <span className="wc26-chip text-[11px]">{player.preferredFoot}</span>}
            </div>
            {recentForm && (
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-white/50">
                Forma · {recentForm}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  )
}
