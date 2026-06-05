import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MOTION } from '../../constants/design'
import { PlayerAvatar } from '../worldcup/PlayerAvatar'
import { TeamCrest } from '../worldcup/TeamCrest'
import type { Player } from '../../types/worldcup'

interface PlayerFifaCardProps {
  player: Player
}

export function PlayerFifaCard({ player }: PlayerFifaCardProps) {
  const rating = player.rating != null && player.rating > 0 ? Math.round(player.rating) : null

  return (
    <motion.div variants={MOTION.enter}>
      <Link to={`/players/${player.id}`} className="wc26-fifa-card group">
        <div className="wc26-fifa-card__shine" aria-hidden="true" />
        <div className="wc26-fifa-card__top">
          {rating != null ? (
            <span className="wc26-fifa-card__rating">{rating}</span>
          ) : (
            <span className="wc26-fifa-card__rating wc26-fifa-card__rating--pending">—</span>
          )}
          {player.shirtNumber != null && player.shirtNumber > 0 && (
            <span className="wc26-fifa-card__number">#{player.shirtNumber}</span>
          )}
        </div>
        <div className="wc26-fifa-card__avatar">
          <PlayerAvatar
            photo={player.photo}
            photoUrl={player.photoUrl}
            name={player.name}
            size="lg"
            shirtNumber={player.shirtNumber}
            position={player.position}
            flagUrl={player.team?.flag}
          />
        </div>
        <p className="wc26-fifa-card__name">{player.name}</p>
        <p className="wc26-fifa-card__meta">
          {player.position ? player.position : 'Pendiente de verificación'}
        </p>
        <div className="wc26-fifa-card__footer">
          {player.team ? (
            <TeamCrest flag={player.team.flag} code={player.team.code} size="sm" />
          ) : null}
          <span className="truncate text-[10px] font-bold text-wc26-text/55">
            {player.team?.code ?? '—'}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}
