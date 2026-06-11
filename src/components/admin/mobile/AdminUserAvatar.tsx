type Props = {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase()
}

export function AdminUserAvatar({ name, size = 'md', className = '' }: Props) {
  return (
    <div className={`admin-user-avatar admin-user-avatar--${size} ${className}`.trim()} aria-hidden>
      <span>{initials(name)}</span>
    </div>
  )
}
