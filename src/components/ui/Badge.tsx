import type { ReactNode } from 'react'
import clsx from 'clsx'

export function Badge({
  children,
  variant = 'primary',
  className,
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'success' | 'warning'
  className?: string
}) {
  const variantClasses = {
    primary: 'bg-worldCupBlue/12 text-worldCupBlue ring-1 ring-worldCupBlue/20',
    secondary: 'bg-white/6 text-platinum ring-1 ring-white/8',
    success: 'bg-worldCupGreen/12 text-worldCupGreen ring-1 ring-worldCupGreen/20',
    warning: 'bg-worldCupRed/12 text-worldCupRed ring-1 ring-worldCupRed/20',
  }

  return (
    <span className={clsx('inline-flex rounded-full px-3 py-1 text-xs font-semibold', variantClasses[variant], className)}>
      {children}
    </span>
  )
}
