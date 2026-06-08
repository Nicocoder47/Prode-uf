const PENDING_KEY = 'prode_pending_registration'

export type PendingRegistration = {
  fullName: string
  dni: string
  legajo: string
  email: string
}

/** DNI argentino: solo dígitos (7–8) */
export function normalizeDni(raw: string): string {
  return raw.trim().replace(/\D/g, '')
}

/** Legajo interno: mayúsculas, sin espacios */
export function normalizeLegajo(raw: string): string {
  return raw.trim().replace(/[\s-]+/g, '').toUpperCase()
}

/** @deprecated usar normalizeLegajo */
export function normalizeDomainPlate(raw: string): string {
  return normalizeLegajo(raw)
}

export function isValidEmail(email: string): boolean {
  const e = email.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export function isValidDni(dni: string): boolean {
  const n = normalizeDni(dni)
  return n.length >= 7 && n.length <= 8
}

export function savePendingRegistration(data: PendingRegistration) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(data))
}

export function readPendingRegistration(): PendingRegistration | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingRegistration & { domainPlate?: string }
    if (parsed.domainPlate && !parsed.legajo) {
      parsed.legajo = parsed.domainPlate
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPendingRegistration() {
  sessionStorage.removeItem(PENDING_KEY)
}

export function mapRegistrationError(code: string): string {
  switch (code) {
    case 'dni_taken':
      return 'Ese DNI ya está registrado por otro usuario.'
    case 'legajo_taken':
      return 'Ese legajo ya está registrado por otro usuario.'
    case 'dni_required':
      return 'Ingresá tu DNI.'
    case 'legajo_required':
      return 'Ingresá tu legajo.'
    case 'invalid_dni':
      return 'El DNI debe tener 7 u 8 dígitos.'
    case 'domain_plate_taken':
      return 'Ese legajo ya está registrado por otro usuario.'
    case 'domain_plate_required':
      return 'Ingresá tu legajo.'
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
