import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MOTION } from '../../../constants/design'

type AdminControlGlassProps = {
  kicker?: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function AdminControlGlass({
  kicker,
  title,
  description,
  action,
  children,
  className = '',
}: AdminControlGlassProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.section
      {...(reduceMotion ? {} : MOTION.enter)}
      className={`admin-control-glass ${className}`.trim()}
    >
      <div className="admin-control-glass__head">
        <div>
          {kicker ? <p className="admin-control-glass__kicker">{kicker}</p> : null}
          <h2 className="admin-control-glass__title">{title}</h2>
          {description ? <p className="admin-control-glass__desc">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </motion.section>
  )
}
