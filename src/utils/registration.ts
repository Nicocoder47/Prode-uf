const PENDING_KEY = 'prode_pending_registration'

export type PendingRegistration = {
  fullName: string
  domainPlate: string
  email: string
}

/** Dominio/patente: mayúsculas, sin espacios ni guiones */
export function normalizeDomainPlate(raw: string): string {
  return raw.trim().replace(/[\s-]+/g, '').toUpperCase()
}

export function isValidEmail(email: string): boolean {
  const e = email.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export function savePendingRegistration(data: PendingRegistration) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(data))
}

export function readPendingRegistration(): PendingRegistration | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingRegistration
  } catch {
    return null
  }
}

export function clearPendingRegistration() {
  sessionStorage.removeItem(PENDING_KEY)
}

export function mapRegistrationError(code: string): string {
  switch (code) {
    case 'domain_plate_taken':
      return 'Ese dominio/patente ya está registrado por otro usuario.'
    case 'domain_plate_required':
      return 'Ingresá tu dominio o patente.'
    case 'invalid_email':
      return 'Ingresá un email válido.'
    case 'full_name_required':
      return 'Ingresá tu nombre completo.'
    default:
      return 'No pudimos validar tus datos. Intentá de nuevo.'
  }
}

export function mapAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('expired') || m.includes('invalid') || m.includes('otp')) {
    return 'Código incorrecto o vencido. Pedí uno nuevo.'
  }
  if (m.includes('rate limit')) {
    return 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.'
  }
  return message
}
