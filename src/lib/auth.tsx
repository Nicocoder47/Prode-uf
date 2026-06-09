import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { PUBLIC_DEMO_ACCESS } from '../config/publicAccess.ts'
import { logUserLogin } from '../services/admin/adminService.ts'
import { supabase } from './supabase'
import {
  clearPendingRegistration,
  isValidDni,
  isValidEmail,
  mapRegistrationError,
  mapSignInError,
  normalizeDni,
  normalizeLegajo,
  readPendingRegistration,
  savePendingRegistration,
  type PendingRegistration,
} from '../utils/registration.ts'

interface Profile {
  id: string
  email: string
  full_name: string
  dni: string | null
  legajo: string | null
  domain_plate: string | null
  role: string
  token_balance: number
  is_active: boolean
  deleted_at: string | null
  last_login_at: string | null
}

export interface AccessRegistrationInput {
  fullName: string
  dni: string
  legajo: string
  email: string
}

export interface AuthStepResult {
  status: 'success' | 'error' | 'pending'
  message: string
  suggestLogin?: boolean
  suggestRegister?: boolean
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  register: (input: AccessRegistrationInput) => Promise<AuthStepResult>
  login: (email: string, dni: string) => Promise<AuthStepResult>
  finalizeSessionProfile: (session: Session) => Promise<AuthStepResult | null>
  signOut: () => Promise<void>
  devSignIn?: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function mapProfileSyncError(message: string): string {
  if (message.includes('dni_taken')) return mapRegistrationError('dni_taken')
  if (message.includes('legajo_taken')) return mapRegistrationError('legajo_taken')
  if (message.includes('dni_required')) return mapRegistrationError('dni_required')
  if (message.includes('legajo_required')) return mapRegistrationError('legajo_required')
  if (message.includes('domain_plate_taken')) return mapRegistrationError('legajo_taken')
  if (message.includes('legajo_not_authorized')) return mapRegistrationError('legajo_not_authorized')
  if (message.includes('legajo_blocked')) return mapRegistrationError('legajo_blocked')
  if (message.includes('legajo_inactive')) return mapRegistrationError('legajo_inactive')
  if (message.includes('dni_mismatch')) return mapRegistrationError('dni_mismatch')
  return message
}

async function assertAccountActive(userId: string): Promise<AuthStepResult | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_active, deleted_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    if (error.message.includes('deleted_at')) {
      const fallback = await supabase.from('profiles').select('is_active').eq('id', userId).maybeSingle()
      if (fallback.error) return { status: 'error', message: fallback.error.message }
      if (fallback.data?.is_active === false) {
        await supabase.auth.signOut()
        return { status: 'error', message: mapRegistrationError('account_disabled') }
      }
      return null
    }
    return { status: 'error', message: error.message }
  }

  if (data?.deleted_at || data?.is_active === false) {
    await supabase.auth.signOut()
    return { status: 'error', message: mapRegistrationError('account_disabled') }
  }
  return null
}

function validateRegistrationInput(input: AccessRegistrationInput): AuthStepResult | null {
  const fullName = input.fullName.trim()
  const dni = normalizeDni(input.dni)
  const legajo = normalizeLegajo(input.legajo)
  const email = input.email.trim().toLowerCase()

  if (!fullName) return { status: 'error', message: mapRegistrationError('full_name_required') }
  if (!dni) return { status: 'error', message: mapRegistrationError('dni_required') }
  if (!isValidDni(dni)) return { status: 'error', message: mapRegistrationError('invalid_dni') }
  if (!legajo) return { status: 'error', message: mapRegistrationError('legajo_required') }
  if (!isValidEmail(email)) return { status: 'error', message: mapRegistrationError('invalid_email') }

  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const DEV_ADMIN = import.meta.env.VITE_DEV_ADMIN === 'true' || !!import.meta.env.VITE_DEV_ADMIN_EMAIL
  const DEV_ADMIN_EMAIL = import.meta.env.VITE_DEV_ADMIN_EMAIL ?? 'dev@local'
  const DEV_ADMIN_PASSWORD = import.meta.env.VITE_DEV_ADMIN_PASSWORD ?? 'devpassword123'

  async function syncUserProfile(input: PendingRegistration): Promise<void> {
    const { error } = await supabase.rpc('sync_user_profile', {
      p_full_name: input.fullName.trim(),
      p_dni: normalizeDni(input.dni),
      p_legajo: normalizeLegajo(input.legajo),
      p_email: input.email.trim().toLowerCase(),
      p_admin_code: null,
    })

    if (error) {
      throw new Error(mapProfileSyncError(error.message))
    }
  }

  async function finalizePendingRegistration(activeSession: Session | null) {
    if (!activeSession?.user?.email) return

    const email = activeSession.user.email.trim().toLowerCase()
    const pending = readPendingRegistration()
    const payload =
      pending?.email.toLowerCase() === email ? pending : pendingFromMetadata(activeSession)

    if (!payload?.dni || !payload?.legajo) return

    await syncUserProfile(payload)
    clearPendingRegistration()
  }

  function pendingFromMetadata(session: Session): PendingRegistration | null {
    const meta = session.user.user_metadata as Record<string, string | undefined>
    const email = session.user.email?.trim().toLowerCase()
    if (!email || !meta?.dni || !meta?.legajo) return null
    return {
      fullName: String(meta.full_name ?? meta.fullName ?? '').trim(),
      dni: normalizeDni(String(meta.dni)),
      legajo: normalizeLegajo(String(meta.legajo)),
      email,
    }
  }

  async function ensureProfileComplete(session: Session, email: string): Promise<AuthStepResult | null> {
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('id, dni, legajo, full_name')
      .eq('id', session.user.id)
      .maybeSingle()

    if (profileErr) {
      await supabase.auth.signOut()
      return { status: 'error', message: profileErr.message }
    }

    if (profileRow?.dni?.trim() && profileRow?.legajo?.trim()) {
      return null
    }

    const pending = readPendingRegistration()
    const payload =
      pending?.email.toLowerCase() === email.toLowerCase() ? pending : pendingFromMetadata(session)

    if (!payload?.dni || !payload?.legajo) {
      await supabase.auth.signOut()
      return { status: 'error', message: mapRegistrationError('profile_incomplete'), suggestRegister: true }
    }

    try {
      await syncUserProfile(payload)
      clearPendingRegistration()
      return null
    } catch (err) {
      await supabase.auth.signOut()
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'No pudimos guardar tu perfil.',
      }
    }
  }

  async function finalizeSessionProfile(session: Session): Promise<AuthStepResult | null> {
    if (!session.user.email) return null

    try {
      await finalizePendingRegistration(session)
      return await ensureProfileComplete(session, session.user.email.trim().toLowerCase())
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'No pudimos guardar tu perfil.',
      }
    }
  }

  async function ensureDevSupabaseSession(): Promise<Session | null> {
    const { data: existing } = await supabase.auth.getSession()
    if (existing.session) return existing.session

    const credentials = { email: DEV_ADMIN_EMAIL, password: DEV_ADMIN_PASSWORD }
    let { data, error } = await supabase.auth.signInWithPassword(credentials)
    if (error) {
      await supabase.auth.signUp(credentials)
      const retry = await supabase.auth.signInWithPassword(credentials)
      data = retry.data
      error = retry.error
    }
    if (error) {
      console.warn('[DEV_ADMIN] No se pudo autenticar en Supabase:', error.message)
      return null
    }
    return data.session
  }

  useEffect(() => {
    let mounted = true

    async function initSession() {
      if (PUBLIC_DEMO_ACCESS) {
        const devSession = await ensureDevSupabaseSession()
        if (mounted) {
          if (devSession) {
            setSession(devSession)
            setUser(devSession.user)
          }
          setLoading(false)
        }
        return
      }

      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      setSession(data.session)
      setUser(data.session?.user ?? null)

      if (data.session) {
        try {
          await finalizePendingRegistration(data.session)
        } catch (err) {
          console.warn('[auth] sync profile:', err)
        }
      } else if (!data.session && DEV_ADMIN && import.meta.env.DEV) {
        const devSession = await ensureDevSupabaseSession()
        if (devSession && mounted) {
          setSession(devSession)
          setUser(devSession.user)
        }
      }

      if (mounted) setLoading(false)
    }

    initSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (!nextSession) {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user?.id || PUBLIC_DEMO_ACCESS) {
      if (!PUBLIC_DEMO_ACCESS) setProfile(null)
      return
    }

    let mounted = true

    async function fetchProfile() {
      let { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, dni, legajo, domain_plate, role, token_balance, is_active, deleted_at, last_login_at')
        .eq('id', user.id)
        .single()

      if (error?.message.includes('deleted_at')) {
        const fallback = await supabase
          .from('profiles')
          .select('id, email, full_name, dni, legajo, domain_plate, role, token_balance, is_active')
          .eq('id', user.id)
          .single()
        data = fallback.data as typeof data
        error = fallback.error
      }

      if (mounted && !error && data) {
        if ('deleted_at' in data && (data.deleted_at || data.is_active === false)) {
          await supabase.auth.signOut()
          setProfile(null)
          return
        }
        if (data.is_active === false) {
          await supabase.auth.signOut()
          setProfile(null)
          return
        }
        setProfile(data as Profile)
      }
    }

    fetchProfile()

    return () => {
      mounted = false
    }
  }, [user])

  const register = async (input: AccessRegistrationInput): Promise<AuthStepResult> => {
    const validationError = validateRegistrationInput(input)
    if (validationError) return validationError

    const fullName = input.fullName.trim()
    const dni = normalizeDni(input.dni)
    const legajo = normalizeLegajo(input.legajo)
    const email = input.email.trim().toLowerCase()

    const { data: rpcValidation, error: validationRpcError } = await supabase.rpc('validate_registration', {
      p_email: email,
      p_dni: dni,
      p_legajo: legajo,
    })

    if (validationRpcError) {
      return { status: 'error', message: validationRpcError.message }
    }

    const result = rpcValidation as { ok?: boolean; code?: string }
    if (!result?.ok) {
      return { status: 'error', message: mapRegistrationError(result.code ?? 'unknown') }
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle()

    if (existingProfile) {
      return {
        status: 'error',
        message: mapRegistrationError('email_taken'),
        suggestLogin: true,
      }
    }

    savePendingRegistration({ fullName, dni, legajo, email })

    const { data, error } = await supabase.auth.signUp({
      email,
      password: dni,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: fullName,
          dni,
          legajo,
        },
      },
    })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return { status: 'error', message: mapRegistrationError('email_taken'), suggestLogin: true }
      }
      return { status: 'error', message: mapSignInError(error.message) }
    }

    if (!data.session) {
      return {
        status: 'pending',
        message:
          'Te enviamos un email de confirmación. Abrilo, confirmá tu cuenta y después entrá con tu email y DNI.',
        suggestLogin: true,
      }
    }

    setSession(data.session)
    setUser(data.session.user)

    try {
      await syncUserProfile({ fullName, dni, legajo, email })
      clearPendingRegistration()
    } catch (err) {
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'No pudimos guardar tu perfil.',
      }
    }

    return {
      status: 'success',
      message:
        '¡Cuenta creada! Recordá: para entrar usás tu email y tu DNI (sin puntos) como contraseña.',
    }
  }

  const login = async (emailRaw: string, dniRaw: string): Promise<AuthStepResult> => {
    const email = emailRaw.trim().toLowerCase()
    const dni = normalizeDni(dniRaw)

    if (!isValidEmail(email)) {
      return { status: 'error', message: mapRegistrationError('invalid_email') }
    }
    if (!isValidDni(dni)) {
      return { status: 'error', message: 'Ingresá tu DNI (7 u 8 dígitos).' }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: dni,
    })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('email not confirmed')) {
        return {
          status: 'error',
          message: 'Confirmá tu email primero (revisá tu bandeja y spam). Después entrá con email + DNI.',
        }
      }
      if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
        return {
          status: 'error',
          message: 'Email o DNI incorrectos. Si es tu primera vez, registrate y confirmá el email.',
          suggestRegister: true,
        }
      }
      return { status: 'error', message: mapSignInError(error.message) }
    }

    if (!data.session) {
      return { status: 'error', message: 'No pudimos iniciar sesión. Intentá de nuevo.' }
    }

    const profileError = await finalizeSessionProfile(data.session)
    if (profileError) return profileError

    const activeError = await assertAccountActive(data.session.user.id)
    if (activeError) return activeError

    try {
      await logUserLogin()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('account_disabled')) {
        await supabase.auth.signOut()
        return { status: 'error', message: mapRegistrationError('account_disabled') }
      }
    }

    setSession(data.session)
    setUser(data.session.user)

    return { status: 'success', message: '¡Bienvenido de nuevo!' }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
  }

  const devSignIn = async () => {
    const devSession = await ensureDevSupabaseSession()
    if (devSession) {
      setSession(devSession)
      setUser(devSession.user)
    }
  }

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      register,
      login,
      finalizeSessionProfile,
      signOut,
      devSignIn: import.meta.env.DEV && DEV_ADMIN ? devSignIn : undefined,
    }),
    [session, user, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
