import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

type ToastItem = { id: number; message: string }

type ToastContextValue = {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string) => {
    const id = Date.now()
    setItems(prev => [...prev, { id, message }])
    window.setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
    }, 3200)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[100] flex justify-center px-4">
        <AnimatePresence>
          {items.map(item => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              className="wc26-toast pointer-events-auto flex items-center gap-2"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
              <span>{item.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useAppToast() {
  return useContext(ToastContext)
}
