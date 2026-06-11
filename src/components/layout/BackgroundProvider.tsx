import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export type BackgroundVariant = 'default' | 'home' | 'hero' | 'play' | 'none'

type BackgroundContextValue = {
  variant: BackgroundVariant
}

const BackgroundContext = createContext<BackgroundContextValue>({ variant: 'default' })

function resolveVariant(pathname: string): BackgroundVariant {
  if (pathname === '/') return 'home'
  if (pathname === '/matches' || pathname.startsWith('/matches/')) return 'play'
  if (pathname === '/login' || pathname === '/registro' || pathname === '/register' || pathname === '/invite') return 'hero'
  return 'default'
}

function isPlayRoute(pathname: string) {
  return pathname === '/matches' || pathname.startsWith('/matches/')
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const variant = useMemo(() => resolveVariant(pathname), [pathname])

  // Login controla su propio fondo — evita capas globales que lo vuelven blanco
  if (pathname === '/login' || pathname === '/registro' || pathname === '/register' || pathname === '/invite') {
    return <>{children}</>
  }

  return (
    <BackgroundContext.Provider value={{ variant }}>
      <div className={`wc26-bg-root${isPlayRoute(pathname) ? ' wc26-bg-root--play' : ''}`}>
        <div className="wc26-bg-base" aria-hidden="true" />
        <div className="wc26-bg-gradient" aria-hidden="true" />
        <div className="wc26-bg-noise" aria-hidden="true" />
        <div
          className={`wc26-bg-mural${isPlayRoute(pathname) ? ' wc26-bg-mural--play' : ''}`}
          aria-hidden="true"
        />
        <div className="wc26-bg-content">{children}</div>
      </div>
    </BackgroundContext.Provider>
  )
}

export function useBackgroundVariant() {
  return useContext(BackgroundContext).variant
}
