import { motion } from 'framer-motion'
import clsx from 'clsx'

interface LiveIndicatorProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  pulse?: boolean
}

export function LiveIndicator({ size = 'md', label = 'LIVE', pulse = true }: LiveIndicatorProps) {
  const sizes = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  }

  const labelSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <motion.div
      className="flex items-center gap-2"
      animate={pulse ? { opacity: [1, 0.6, 1] } : {}}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <div className="relative">
        <div className={clsx('rounded-full bg-red-500', sizes[size])} />
        <motion.div
          className={clsx('absolute inset-0 rounded-full bg-red-500', sizes[size])}
          animate={pulse ? { scale: [1, 1.5, 2.5], opacity: [1, 0.5, 0] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>
      <span className={clsx('font-semibold uppercase text-red-400', labelSizes[size])}>{label}</span>
    </motion.div>
  )
}

interface CountdownProps {
  timestamp: number
  onComplete?: () => void
}

export function Countdown({ timestamp }: CountdownProps) {
  const hours = Math.floor((timestamp % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((timestamp % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timestamp % (1000 * 60)) / 1000)

  return (
    <motion.div
      className="flex items-center gap-2 font-mono text-2xl font-bold text-white"
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <span className="inline-block w-12 text-right">{String(hours).padStart(2, '0')}</span>
      <span className="text-cyan-300">:</span>
      <span className="inline-block w-12 text-center">{String(minutes).padStart(2, '0')}</span>
      <span className="text-cyan-300">:</span>
      <span className="inline-block w-12 text-left">{String(seconds).padStart(2, '0')}</span>
    </motion.div>
  )
}

export function SkeletonLoader({ className }: { className?: string }) {
  return (
    <motion.div
      className={clsx('rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900', className)}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  )
}
