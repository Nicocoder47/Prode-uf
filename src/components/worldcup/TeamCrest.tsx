import { isLikelyImageUrl, resolveTeamFlagUrl, teamAbbreviation } from '../../utils/teamDisplay'

interface TeamCrestProps {
  flag?: string | null
  code?: string
  name?: string
  countryCode?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  premium?: boolean
}

const sizes = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-12 w-12 text-xs',
  lg: 'h-16 w-16 text-sm',
  xl: 'h-[5.5rem] w-[5.5rem] text-lg',
}

export function TeamCrest({
  flag,
  code,
  name,
  countryCode,
  size = 'md',
  className = '',
  premium = false,
}: TeamCrestProps) {
  const imageUrl = resolveTeamFlagUrl(flag, flag, countryCode, code)
  const emojiFlag = flag && !isLikelyImageUrl(flag) && flag !== '🏳️' ? flag : null
  const innerSize = sizes[size]

  const content = imageUrl ? (
    <img
      src={imageUrl}
      alt={name || code || 'Equipo'}
      loading="lazy"
      decoding="async"
      className="h-full w-full rounded-full object-cover"
    />
  ) : (
    <span className="text-[1.35em] leading-none" aria-hidden>
      {emojiFlag || teamAbbreviation(code, name)}
    </span>
  )

  if (premium) {
    return (
      <span className={`wc26-crest-premium wc26-crest-premium--${size} ${className}`.trim()}>
        <span className="wc26-crest-premium__halo" aria-hidden="true" />
        <span className="wc26-crest-premium__ring">
          <span className={`wc26-crest-premium__inner ${innerSize}`}>{content}</span>
        </span>
      </span>
    )
  }

  return (
    <span
      className={`${innerSize} grid shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-wc26-gray300/70 ${className}`}
    >
      {content}
    </span>
  )
}
