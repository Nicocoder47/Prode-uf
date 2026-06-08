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

const OTP_COOLDOWN_MS = 30_000
const OTP_COOLDOWN_KEY = 'prode_otp_sent_at'

export function markOtpSent() {
  sessionStorage.setItem(OTP_COOLDOWN_KEY, String(Date.now()))
}

export function clearOtpCooldown() {
  sessionStorage.removeItem(OTP_COOLDOWN_KEY)
}

export function getOtpCooldownSeconds(): number {
  try {
    const raw = sessionStorage.getItem(OTP_COOLDOWN_KEY)
    if (!raw) return 0
    const remaining = Math.ceil((OTP_COOLDOWN_MS - (Date.now() - Number(raw))) / 1000)
    return remaining > 0 ? remaining : 0
  } catch {
    return 0
  }
}

export function resetAuthAttempt() {
  clearAuthPending()
  clearOtpCooldown()
}

export async function verifyEmailOtp(
  supabaseClient: { auth: { verifyOtp: (params: { email: string; token: string; type: string }) => Promise<{ data: { session: unknown } | null; error: { message: string } | null }> } },
  email: string,
  token: string,
) {
  const types = ['email', 'signup', 'magiclink'] as const
  let lastError: { message: string } | null = null

  for (const type of types) {
    const { data, error } = await supabaseClient.auth.verifyOtp({ email, token, type })
    if (!error && data.session) {
      return { data, error: null }
    }
    lastError = error
  }

  return { data: null, error: lastError }
}

export function mapAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('expired') || m.includes('invalid') || m.includes('otp')) {
    return 'Código incorrecto o vencido. Pedí uno nuevo.'
  }
  if (m.includes('rate limit') || m.includes('over_email_send_rate_limit') || m.includes('429')) {
    return 'Límite de envíos alcanzado. Si ya te llegó un código por email, ingresalo abajo.'
  }
  return message
}
