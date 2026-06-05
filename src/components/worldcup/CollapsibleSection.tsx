import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { MOTION } from '../../constants/design'

type CollapsibleSectionProps = {
  triggerLabel: string
  children: ReactNode
  className?: string
}

export function CollapsibleSection({ triggerLabel, children, className = '' }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <section className={`wc26-collapsible ${className}`}>
      <motion.button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="wc26-collapsible__trigger"
        {...MOTION.tap}
        aria-expanded={open}
      >
        <span>{triggerLabel}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
