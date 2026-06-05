import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export type BackgroundVariant = 'default' | 'home' | 'hero' | 'none'

type BackgroundContextValue = {
  variant: BackgroundVariant
}

const BackgroundContext = createContext<BackgroundContextValue>({ variant: 'default' })

function resolveVariant(pathname: string): BackgroundVariant {
  if (pathname === '/') return 'home'
  if (pathname === '/invite') return 'hero'
  return 'default'
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const variant = useMemo(() => resolveVariant(pathname), [pathname])

  return (
    <BackgroundContext.Provider value={{ variant }}>
      <div className="wc26-bg-root">
        <div className="wc26-bg-base" aria-hidden="true" />
        <div className="wc26-bg-gradient" aria-hidden="true" />
        <div className="wc26-bg-noise" aria-hidden="true" />
        {variant === 'home' && <div className="wc26-bg-mural md:hidden" aria-hidden="true" />}
        <div className="wc26-bg-content">{children}</div>
      </div>
    </BackgroundContext.Provider>
  )
}

export function useBackgroundVariant() {
  return useContext(BackgroundContext).variant
}
