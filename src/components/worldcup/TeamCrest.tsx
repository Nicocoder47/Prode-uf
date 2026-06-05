import { isLikelyImageUrl, resolveTeamImageUrl, teamAbbreviation } from '../../utils/teamDisplay'

interface TeamCrestProps {
  flag?: string | null
  code?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'h-8 w-8 text-[10px]', md: 'h-12 w-12 text-xs', lg: 'h-20 w-20 text-base' }

export function TeamCrest({ flag, code, name, size = 'md', className = '' }: TeamCrestProps) {
  const wrapper = `${sizes[size]} grid shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-wc26-gray300/70 ${className}`
  const imageUrl = resolveTeamImageUrl(flag)
  const emojiFlag = flag && !isLikelyImageUrl(flag) ? flag : null

  if (imageUrl) {
    return (
      <span className={wrapper}>
        <img
          src={imageUrl}
          alt={name || code || 'Equipo'}
          loading="lazy"
          className="h-[78%] w-[78%] object-contain"
        />
      </span>
    )
  }

  return (
    <span className={`${wrapper} font-black text-wc26-blue`} aria-hidden>
      {emojiFlag || teamAbbreviation(code, name)}
    </span>
  )
}
