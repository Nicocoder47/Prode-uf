import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { insertDeviceReport } from '../services/deviceReportService'
import { getDeviceContext } from '../utils/deviceInfo'

const THROTTLE_MS = {
  page_view: 30_000,
  error: 60_000,
  performance: 60_000,
} as const

type ThrottleKey = `${string}:${string}`

function shouldThrottle(store: Map<ThrottleKey, number>, key: ThrottleKey, windowMs: number) {
  const now = Date.now()
  const last = store.get(key) ?? 0
  if (now - last < windowMs) return true
  store.set(key, now)
  return false
}

function safeReport(
  store: Map<ThrottleKey, number>,
  eventType: keyof typeof THROTTLE_MS,
  route: string,
  extra?: { error_message?: string; performance_ms?: number },
  userId?: string | null,
) {
  const throttleKey = `${eventType}:${route}:${extra?.error_message?.slice(0, 80) ?? ''}` as ThrottleKey
  if (shouldThrottle(store, throttleKey, THROTTLE_MS[eventType])) return

  const ctx = getDeviceContext()
  void insertDeviceReport({
    user_id: userId ?? null,
    session_id: ctx.sessionId,
    device_type: ctx.deviceType,
    browser: ctx.browser,
    os: ctx.os,
    viewport_width: ctx.viewportWidth,
    viewport_height: ctx.viewportHeight,
    user_agent: ctx.userAgent,
    route,
    event_type: eventType,
    error_message: extra?.error_message ?? null,
    performance_ms: extra?.performance_ms ?? null,
  }).catch(() => {
    /* no romper la app */
  })
}

/**
 * Tracking liviano de dispositivo/ruta/errores. Throttled, fire-and-forget.
 */
export function useDeviceReporter() {
  const location = useLocation()
  const { user } = useAuth()
  const throttleStore = useRef(new Map<ThrottleKey, number>())
  const routeStart = useRef(performance.now())

  useEffect(() => {
    const onError = (message: string, source?: string, lineno?: number) => {
      safeReport(
        throttleStore.current,
        'error',
        location.pathname,
        { error_message: `${message} @ ${source ?? ''}:${lineno ?? 0}`.slice(0, 500) },
        user?.id,
      )
    }

    const handleWindowError = (event: ErrorEvent) => {
      onError(event.message, event.filename, event.lineno)
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason ?? 'unhandledrejection')
      onError(msg)
    }

    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleWindowError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [location.pathname, user?.id])

  useEffect(() => {
    const route = location.pathname
    const elapsed = Math.round(performance.now() - routeStart.current)
    routeStart.current = performance.now()

    safeReport(throttleStore.current, 'page_view', route, undefined, user?.id)

    const perfTimer = window.setTimeout(() => {
      safeReport(
        throttleStore.current,
        'performance',
        route,
        { performance_ms: elapsed },
        user?.id,
      )
    }, 100)

    return () => window.clearTimeout(perfTimer)
  }, [location.pathname, user?.id])
}
