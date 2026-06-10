export type DeviceType = 'mobile' | 'tablet' | 'desktop'

const SESSION_KEY = 'prode_device_session_id'

export function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export function detectDeviceType(): DeviceType {
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

export function detectBrowser(ua: string): string {
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  return 'Other'
}

export function detectOS(ua: string): string {
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac OS')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  return 'Other'
}

export function getDeviceContext() {
  const ua = navigator.userAgent
  return {
    sessionId: getOrCreateSessionId(),
    deviceType: detectDeviceType(),
    browser: detectBrowser(ua),
    os: detectOS(ua),
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    userAgent: ua.slice(0, 500),
  }
}
