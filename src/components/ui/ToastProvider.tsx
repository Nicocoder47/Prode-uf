import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { useMotionEnabled } from '../../utils/adaptiveMotion'

type ToastItem = { id: number; message: string; tone: 'success' | 'error' }

type ToastContextValue = {
  showToast: (message: string, tone?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

function ToastItemView({ message, tone }: { message: string; tone: 'success' | 'error' }) {
  return (
    <>
      <CheckCircle2 className={`h-5 w-5 shrink-0 ${tone === 'error' ? 'text-red-300' : 'text-white'}`} />
      <span className="text-center">{message}</span>
    </>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const motionOn = useMotionEnabled()
  const [items, setItems] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now()
    setItems(prev => [...prev, { id, message, tone }])
    window.setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
    }, tone === 'error' ? 6000 : 4200)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[100] flex justify-center px-4">
        {motionOn ? (
          <AnimatePresence>
            {items.map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                className={`wc26-toast pointer-events-auto flex items-center justify-center gap-2 text-center${item.tone === 'error' ? ' wc26-toast--error' : ' wc26-toast--success'}`}
              >
                <ToastItemView message={item.message} tone={item.tone} />
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          items.map(item => (
            <div key={item.id} className={`wc26-toast pointer-events-auto flex items-center justify-center gap-2 text-center${item.tone === 'error' ? ' wc26-toast--error' : ' wc26-toast--success'}`}>
              <ToastItemView message={item.message} tone={item.tone} />
            </div>
          ))
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useAppToast() {
  return useContext(ToastContext)
}
