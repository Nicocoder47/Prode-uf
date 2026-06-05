import type { ReactNode } from 'react'
import clsx from 'clsx'

export function GlassCard({
  title,
  description,
  children,
  className,
}: {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={clsx(
        'rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-glass backdrop-blur-xl',
        className,
      )}
    >
      {title ? (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">{title}</p>
          {description ? <p className="mt-2 text-sm text-slate-300">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
