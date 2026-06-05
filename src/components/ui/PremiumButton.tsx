import clsx from 'clsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface PremiumButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean
  icon?: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-fifaBlue to-trophyGold text-slate-950 shadow-glow-blue hover:brightness-110',
  secondary: 'border border-white/20 bg-[rgba(255,255,255,0.08)] text-white hover:border-white/40 hover:bg-[rgba(255,255,255,0.12)]',
  ghost: 'text-slate-300 hover:text-white hover:bg-[rgba(255,255,255,0.08)]',
  success: 'border border-liveGreen/30 bg-[rgba(34,197,94,0.12)] text-liveGreen hover:border-liveGreen/50',
  danger: 'border border-liveRed/30 bg-[rgba(239,68,68,0.12)] text-liveRed hover:border-liveRed/50',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-4 text-base',
}

export function PremiumButton({
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  icon,
  children,
  disabled,
  ...props
}: PremiumButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95',
        variantStyles[variant],
        sizeStyles[size],
        isLoading && 'opacity-75 cursor-wait pointer-events-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  )
}
