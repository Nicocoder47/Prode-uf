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

const PENDING_LOGIN_KEY = 'prode_pending_login'

export function savePendingLogin(email: string) {
  sessionStorage.setItem(PENDING_LOGIN_KEY, email.trim().toLowerCase())
}

export function readPendingLogin(): string | null {
  return sessionStorage.getItem(PENDING_LOGIN_KEY)
}

export function clearPendingLogin() {
  sessionStorage.removeItem(PENDING_LOGIN_KEY)
}

export function clearAuthPending() {
  clearPendingRegistration()
  clearPendingLogin()
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
    case 'account_not_found':
      return 'No encontramos una cuenta con ese email. Registrate primero.'
    case 'email_taken':
      return 'Ese email ya está registrado. Usá Iniciar sesión.'
    case 'profile_incomplete':
      return 'Tu cuenta está incompleta. Completá el registro con DNI y legajo.'
    default:
      return 'No pudimos validar tus datos. Intentá de nuevo.'
  }
}

export function mapSignInError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Email o DNI incorrectos.'
  }
  if (m.includes('email not confirmed')) {
    return 'Tenés que confirmar tu email antes de ingresar.'
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return mapRegistrationError('email_taken')
  }
  return message
}

export function mapAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Email o DNI incorrectos.'
  }
  return message
}
