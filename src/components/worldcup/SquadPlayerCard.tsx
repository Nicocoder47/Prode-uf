import { Link } from 'react-router-dom'
import type { Player } from '../../types/worldcup'
import { PlayerAvatar } from './PlayerAvatar'

type SquadPlayerCardProps = {
  player: Player
}

/** Muestra solo datos reales presentes; oculta lo que no existe (sin guiones gigantes). */
export function SquadPlayerCard({ player }: SquadPlayerCardProps) {
  const age = player.age != null && player.age > 0 ? `${player.age} años` : null
  const club = player.club?.trim() || null
  const nationality = player.nationality?.trim() || null

  const metaLine = [player.position?.trim() || null, age].filter(Boolean).join(' · ')

  const stats = [
    { label: 'G', value: player.goals },
    { label: 'A', value: player.assists },
    { label: 'PJ', value: player.appearances },
  ].filter(s => typeof s.value === 'number' && s.value > 0)

  return (
    <Link
      to={`/players/${player.id}`}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-wc26-green/5 active:scale-[0.99]"
    >
      <PlayerAvatar
        photo={player.photo}
        photoUrl={player.photoUrl}
        provider={player.provider}
        providerPlayerId={player.providerPlayerId}
        apiFootballId={player.apiFootballId}
        theSportsDbId={player.theSportsDbId}
        name={player.name}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-black text-wc26-text">{player.name}</p>
        {metaLine && <p className="truncate text-xs font-semibold text-wc26-text/50">{metaLine}</p>}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-wc26-text/40">
          {club && <span className="truncate">{club}</span>}
          {nationality && (
            <span className="truncate">
              {club ? '· ' : ''}
              {nationality}
            </span>
          )}
        </div>
        {stats.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {stats.map(s => (
              <span
                key={s.label}
                className="rounded-md bg-wc26-green/10 px-1.5 py-0.5 text-[10px] font-black text-wc26-green"
              >
                {s.value} {s.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <span className="grid h-10 min-w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-wc26-green/15 to-wc26-blue/10 text-xs font-black text-wc26-green">
        {player.shirtNumber != null ? `#${player.shirtNumber}` : ''}
      </span>
    </Link>
  )
}
