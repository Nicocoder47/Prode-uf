import { useId } from 'react'

export type PremiumNavIconName = 'home' | 'teams' | 'fixture' | 'predictions' | 'ranking' | 'profile'

const ICON_ACCENTS: Record<Exclude<PremiumNavIconName, 'fixture'>, string> = {
  home: '#FFE566',
  teams: '#6EC1FF',
  predictions: '#FF9F43',
  ranking: '#F8B91E',
  profile: '#CDB4FF',
}

type PremiumNavIconProps = {
  name: PremiumNavIconName
  active?: boolean
  className?: string
}

export function PremiumNavIcon({ name, active = false, className = '' }: PremiumNavIconProps) {
  if (name === 'fixture') return null

  const uid = useId().replace(/:/g, '')
  const accent = ICON_ACCENTS[name]
  const fill = `${uid}-fill`
  const stroke = `${uid}-stroke`
  const accentGrad = `${uid}-accent`
  const rim = active ? 2.1 : 1.85

  return (
    <svg
      width={32}
      height={32}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={fill} x1="8" y1="6" x2="24" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#ffffff' : '#f4f8f6'} />
          <stop offset="100%" stopColor={active ? accent : '#b8c4be'} />
        </linearGradient>
        <linearGradient id={stroke} x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor={active ? accent : 'rgba(255,255,255,0.82)'} />
          <stop offset="100%" stopColor={active ? '#c99700' : accent} />
        </linearGradient>
        <linearGradient id={accentGrad} x1="10" y1="8" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff8dc" />
          <stop offset="45%" stopColor={accent} />
          <stop offset="100%" stopColor={active ? '#b8860b' : accent} />
        </linearGradient>
        <filter id={`${uid}-shadow`} x="-20%" y="-15%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.2" floodColor="#000" floodOpacity="0.38" />
        </filter>
      </defs>

      <g filter={`url(#${uid}-shadow)`}>
        {name === 'home' && (
          <>
            <path
              d="M5.5 14.5 16 5.5 26.5 14.5V25a1.8 1.8 0 0 1-1.8 1.8H7.3A1.8 1.8 0 0 1 5.5 25V14.5Z"
              fill={`url(#${fill})`}
              stroke={`url(#${stroke})`}
              strokeWidth={rim}
              strokeLinejoin="round"
            />
            <path
              d="M12.5 26.8V16.8h7v10"
              fill={active ? 'rgba(255,215,0,0.35)' : 'rgba(0,0,0,0.18)'}
              stroke={`url(#${stroke})`}
              strokeWidth={rim - 0.2}
              strokeLinejoin="round"
            />
            <path d="M16 5.5V9.5" stroke={`url(#${accentGrad})`} strokeWidth="2.2" strokeLinecap="round" />
          </>
        )}

        {name === 'teams' && (
          <>
            <path
              d="M16 4.5c4.6 0 8.6 2.4 10 6.1-.6 4.9-3.5 9.1-10 12-6.5-2.9-9.4-7.1-10-12 1.4-3.7 5.4-6.1 10-6.1Z"
              fill={`url(#${fill})`}
              stroke={`url(#${stroke})`}
              strokeWidth={rim}
              strokeLinejoin="round"
            />
            <path d="M16 9.5v7.5" stroke={`url(#${accentGrad})`} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M12 13h8" stroke={`url(#${accentGrad})`} strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}

        {name === 'predictions' && (
          <>
            <circle cx="16" cy="16" r="10.5" fill={`url(#${fill})`} stroke={`url(#${stroke})`} strokeWidth={rim} />
            <circle cx="16" cy="16" r="6.5" fill="none" stroke={`url(#${accentGrad})`} strokeWidth="2" opacity="0.95" />
            <circle cx="16" cy="16" r="2.8" fill={`url(#${accentGrad})`} stroke="#fff" strokeWidth="0.8" />
          </>
        )}

        {name === 'ranking' && (
          <>
            <path
              d="M9.5 8.5h13l-1.2 3.8h-10.6L9.5 8.5Z"
              fill={`url(#${fill})`}
              stroke={`url(#${stroke})`}
              strokeWidth={rim}
              strokeLinejoin="round"
            />
            <path
              d="M11.2 12.3h9.6l1.1 11.2H10.1l1.1-11.2Z"
              fill={`url(#${fill})`}
              stroke={`url(#${stroke})`}
              strokeWidth={rim}
              strokeLinejoin="round"
            />
            <path
              d="M13.2 23.5h5.6l.7 2.2H12.5l.7-2.2Z"
              fill={active ? 'rgba(255,215,0,0.35)' : 'rgba(0,0,0,0.16)'}
              stroke={`url(#${stroke})`}
              strokeWidth={rim - 0.2}
              strokeLinejoin="round"
            />
            <path
              d="M12.2 8.5 13.6 5.8h4.8l1.4 2.7"
              fill="none"
              stroke={`url(#${accentGrad})`}
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {name === 'profile' && (
          <>
            <circle cx="16" cy="11.5" r="4.8" fill={`url(#${fill})`} stroke={`url(#${stroke})`} strokeWidth={rim} />
            <path
              d="M7.5 27.5c1.4-4.2 4.6-7 8.5-7s7.1 2.8 8.5 7"
              fill={`url(#${fill})`}
              stroke={`url(#${stroke})`}
              strokeWidth={rim}
              strokeLinecap="round"
            />
            <circle cx="16" cy="11.5" r="1.6" fill={`url(#${accentGrad})`} opacity="0.85" />
          </>
        )}
      </g>
    </svg>
  )
}

export function PremiumPlayIcon({ active = false, className = '' }: { active?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const body = `${uid}-play-body`
  const gloss = `${uid}-play-gloss`

  return (
    <svg
      width={34}
      height={34}
      viewBox="0 0 34 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={body} x1="10" y1="8" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3d2800" />
          <stop offset="100%" stopColor="#080604" />
        </linearGradient>
        <linearGradient id={gloss} x1="12" y1="9" x2="20" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.75)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id={`${uid}-play-shadow`} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.3" floodColor="#000" floodOpacity="0.5" />
        </filter>
      </defs>
      <g filter={`url(#${uid}-play-shadow)`}>
        <path
          d="M11.5 9.2c-1.1-.7-2.4.2-2.4 1.45v12.7c0 1.25 1.35 2.05 2.4 1.45l10.6-6.35c1.05-.62 1.05-2.08 0-2.7L11.5 9.2Z"
          fill={`url(#${body})`}
          stroke={active ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)'}
          strokeWidth="0.85"
          strokeLinejoin="round"
        />
        <path d="M13.5 11.5 22.5 17 13.5 22.5V11.5Z" fill={`url(#${gloss})`} />
      </g>
    </svg>
  )
}
