import { playerInitials, positionAbbrev, positionColor } from '../../utils/playerPhoto'
import { TeamCrest } from '../worldcup/TeamCrest'

interface PlayerCardFallbackProps {
  name: string
  shirtNumber?: number | null
  position?: string | null
  nationality?: string | null
  flagUrl?: string | null
  teamCode?: string | null
  size?: 'md' | 'lg' | 'hero'
  className?: string
}

const sizeMap = {
  md: { box: 'h-14 w-14', initials: 'text-lg', num: 'text-xs', badge: 'text-[8px]' },
  lg: { box: 'h-28 w-28', initials: 'text-4xl', num: 'text-sm', badge: 'text-[9px]' },
  hero: { box: 'h-36 w-36 sm:h-40 sm:w-40', initials: 'text-5xl', num: 'text-base', badge: 'text-[10px]' },
}

export function PlayerCardFallback({
  name,
  shirtNumber,
  position,
  nationality,
  flagUrl,
  teamCode,
  size = 'hero',
  className = '',
}: PlayerCardFallbackProps) {
  const sz = sizeMap[size]
  const posLabel = positionAbbrev(position)

  return (
    <div className={`wc26-player-fallback ${className}`}>
      <div
        className={`${sz.box} wc26-player-fallback__card relative grid place-items-center overflow-hidden rounded-2xl font-black text-white shadow-wc26-float ring-2 ring-white/40`}
        style={{ background: positionColor(position) }}
      >
        <span className="wc26-player-fallback__shine" aria-hidden="true" />
        {shirtNumber != null && shirtNumber > 0 && (
          <span className={`absolute left-2 top-2 font-mono font-black opacity-90 ${sz.num}`}>
            {shirtNumber}
          </span>
        )}
        <span className={`relative z-10 ${sz.initials}`}>{playerInitials(name)}</span>
        {posLabel && (
          <span
            className={`absolute bottom-2 rounded-full bg-black/70 px-2 py-0.5 font-black uppercase tracking-wide text-white ${sz.badge}`}
          >
            {posLabel}
          </span>
        )}
        {(flagUrl || teamCode) && (
          <span className="absolute right-2 top-2">
            {flagUrl ? (
              <TeamCrest flag={flagUrl} code={teamCode ?? ''} size="sm" />
            ) : (
              <span className="rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-black text-wc26-text">
                {nationality?.slice(0, 3).toUpperCase() ?? teamCode}
              </span>
            )}
          </span>
        )}
      </div>
      <span className="wc26-player-fallback__photo-badge">Pendiente de foto</span>
    </div>
  )
}
