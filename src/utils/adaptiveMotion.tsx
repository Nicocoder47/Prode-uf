import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { ENABLE_HEAVY_ANIMATIONS } from '../config/betaMode'
import { useLowEndMobile } from '../hooks/useLowEndMobile'

/** Animaciones Framer solo si heavy animations está ON y el usuario no pidió reducir movimiento. */
export function useMotionEnabled(): boolean {
  const reduced = useReducedMotion()
  const lowEndMobile = useLowEndMobile()
  return ENABLE_HEAVY_ANIMATIONS && !reduced && !lowEndMobile
}

type AdaptiveSectionProps = {
  motionProps?: HTMLMotionProps<'section'>
  className?: string
  style?: CSSProperties
  id?: string
  'aria-label'?: string
  children?: ReactNode
}

export function AdaptiveSection({
  motionProps,
  children,
  className,
  style,
  id,
  'aria-label': ariaLabel,
}: AdaptiveSectionProps) {
  const enabled = useMotionEnabled()
  if (!enabled) {
    return (
      <section className={className} style={style} id={id} aria-label={ariaLabel}>
        {children}
      </section>
    )
  }
  return (
    <motion.section {...motionProps} className={className} style={style} id={id} aria-label={ariaLabel}>
      {children}
    </motion.section>
  )
}

type AdaptiveDivProps = {
  motionProps?: HTMLMotionProps<'div'>
  className?: string
  style?: CSSProperties
  id?: string
  role?: string
  'aria-label'?: string
  children?: ReactNode
}

export function AdaptiveDiv({
  motionProps,
  children,
  className,
  style,
  id,
  role,
  'aria-label': ariaLabel,
}: AdaptiveDivProps) {
  const enabled = useMotionEnabled()
  if (!enabled) {
    return (
      <div className={className} style={style} id={id} role={role} aria-label={ariaLabel}>
        {children}
      </div>
    )
  }
  return (
    <motion.div {...motionProps} className={className} style={style} id={id} role={role} aria-label={ariaLabel}>
      {children}
    </motion.div>
  )
}

type AdaptiveButtonProps = ComponentPropsWithoutRef<'button'> & {
  motionProps?: HTMLMotionProps<'button'>
}

export function AdaptiveButton({
  motionProps,
  children,
  className,
  type = 'button',
  onClick,
  disabled,
}: AdaptiveButtonProps) {
  const enabled = useMotionEnabled()
  if (!enabled) {
    return (
      <button type={type} className={className} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    )
  }
  return (
    <motion.button
      {...motionProps}
      type={type}
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  )
}
