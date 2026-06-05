import type { ReactNode } from 'react'
import clsx from 'clsx'
// Design system and constants imported for reference
interface PremiumCardProps {
  children: ReactNode
  title?: string
  description?: string
  variant?: 'default' | 'dark' | 'elevated' | 'premium'
  className?: string
  onClick?: () => void
  interactive?: boolean
}

export function PremiumCard({
  children,
  title,
  description,
  variant = 'default',
  className,
  onClick,
  interactive = false,
}: PremiumCardProps) {
  const variants = {
    default: 'border border-white/10 bg-[rgba(255,255,255,0.05)] backdrop-blur-xl shadow-glass',
    dark: 'border border-white/10 bg-[rgba(4,8,24,0.85)] backdrop-blur-xl shadow-glass',
    elevated: 'border border-white/10 bg-[rgba(8,18,44,0.76)] backdrop-blur-xl shadow-glassCard',
    premium: 'border border-[rgba(37,99,235,0.25)] bg-gradient-to-br from-[rgba(37,99,235,0.08)] to-[rgba(245,196,81,0.08)] backdrop-blur-xl shadow-[0_0_40px_rgba(37,99,235,0.12)]',
  }

  return (
    <div
      className={clsx(
        'rounded-[32px] p-6 transition-all duration-300',
        variants[variant],
        interactive && 'cursor-pointer hover:shadow-lg hover:border-white/15 active:scale-95',
        className,
      )}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : -1}
    >
      {title ? (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">{title}</p>
          {description ? <p className="text-sm text-slate-300">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

interface StatsPillProps {
  label: string
  value: string | number
  change?: number
  icon?: ReactNode
  highlight?: boolean
}

export function StatsPill({ label, value, change, icon, highlight }: StatsPillProps) {
  return (
    <div className={clsx(
      'flex items-center gap-3 rounded-full px-4 py-2 backdrop-blur-sm',
      highlight
        ? 'border border-[rgba(6,182,212,0.35)] bg-[rgba(6,182,212,0.10)] text-[#DFF9FF]'
        : 'border border-white/10 bg-[rgba(255,255,255,0.04)] text-slate-200',
    )}>
      {icon ? <span className="text-lg">{icon}</span> : null}
      <div>
        <p className="text-xs text-slate-400 uppercase">{label}</p>
        <p className="text-sm font-semibold text-white">
          {value}
          {change ? <span className={change > 0 ? 'text-green-400' : 'text-red-400'}> {change > 0 ? '+' : ''}{change}</span> : null}
        </p>
      </div>
    </div>
  )
}
