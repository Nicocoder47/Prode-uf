import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { PUBLIC_DEMO_ACCESS } from '../config/publicAccess.ts'
import { supabase } from './supabase'
import {
  clearPendingRegistration,
  isValidEmail,
  mapAuthError,
  mapRegistrationError,
  normalizeDomainPlate,
  readPendingRegistration,
  savePendingRegistration,
  type PendingRegistration,
} from '../utils/registration.ts'

interface Profile {
  id: string
  email: string
  full_name: string
  domain_plate: string | null
  role: string
  token_balance: number
  is_active: boolean
}

export interface AccessRegistrationInput {
  fullName: string
  domainPlate: string
  email: string
}

export interface AuthStepResult {
  status: 'success' | 'pending' | 'error'
  message: string
  email?: string
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  requestAccessCode: (input: AccessRegistrationInput) => Promise<AuthStepResult>
  verifyAccessCode: (email: string, code: string) => Promise<AuthStepResult>
  signOut: () => Promise<void>
  devSignIn?: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

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
      p_domain_plate: normalizeDomainPlate(input.domainPlate),
      p_email: input.email.trim().toLowerCase(),
    })

    if (error) {
      if (error.message.includes('domain_plate_taken')) {
        throw new Error(mapRegistrationError('domain_plate_taken'))
      }
      throw new Error(error.message)
    }
  }

  async function finalizePendingRegistration(activeSession: Session | null) {
    const pending = readPendingRegistration()
    if (!pending || !activeSession?.user?.email) return

    if (pending.email.trim().toLowerCase() !== activeSession.user.email.trim().toLowerCase()) return

    await syncUserProfile(pending)
    clearPendingRegistration()
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
      } else if (DEV_ADMIN && import.meta.env.DEV) {
        const devSession = await ensureDevSupabaseSession()
        if (devSession && mounted) {
          setSession(devSession)
          setUser(devSession.user)
        }
      }

      if (mounted) setLoading(false)
    }

    initSession()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (event === 'SIGNED_IN' && nextSession) {
        try {
          await finalizePendingRegistration(nextSession)
        } catch (err) {
          console.warn('[auth] sync profile on sign-in:', err)
        }
      }

      if (event === 'SIGNED_OUT') {
        clearPendingRegistration()
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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, domain_plate, role, token_balance, is_active')
        .eq('id', user.id)
        .single()

      if (mounted && !error && data) {
        setProfile(data)
      }
    }

    fetchProfile()

    return () => {
      mounted = false
    }
  }, [user])

  const requestAccessCode = async (input: AccessRegistrationInput): Promise<AuthStepResult> => {
    const fullName = input.fullName.trim()
    const domainPlate = normalizeDomainPlate(input.domainPlate)
    const email = input.email.trim().toLowerCase()

    if (!fullName) {
      return { status: 'error', message: mapRegistrationError('full_name_required') }
    }
    if (!domainPlate) {
      return { status: 'error', message: mapRegistrationError('domain_plate_required') }
    }
    if (!isValidEmail(email)) {
      return { status: 'error', message: mapRegistrationError('invalid_email') }
    }

    const { data: validation, error: validationError } = await supabase.rpc('validate_registration', {
      p_email: email,
      p_domain_plate: domainPlate,
    })

    if (validationError) {
      return { status: 'error', message: validationError.message }
    }

    const result = validation as { ok?: boolean; code?: string }
    if (!result?.ok) {
      return { status: 'error', message: mapRegistrationError(result.code ?? 'unknown') }
    }

    savePendingRegistration({ fullName, domainPlate, email })

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: fullName,
          domain_plate: domainPlate,
        },
      },
    })

    if (otpError) {
      return { status: 'error', message: mapAuthError(otpError.message) }
    }

    return {
      status: 'pending',
      message: 'Te enviamos un código a tu email. Revisá también spam o correo no deseado.',
      email,
    }
  }

  const verifyAccessCode = async (email: string, code: string): Promise<AuthStepResult> => {
    const cleanEmail = email.trim().toLowerCase()
    const token = code.replace(/\D/g, '').trim()

    if (!isValidEmail(cleanEmail)) {
      return { status: 'error', message: mapRegistrationError('invalid_email') }
    }
    if (token.length < 6) {
      return { status: 'error', message: 'Ingresá el código completo que te enviamos por email.' }
    }

    const pending = readPendingRegistration()
    if (!pending || pending.email.toLowerCase() !== cleanEmail) {
      return { status: 'error', message: 'Volvé a completar tus datos para solicitar un código nuevo.' }
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token,
      type: 'email',
    })

    if (error || !data.session) {
      return { status: 'error', message: mapAuthError(error?.message ?? 'Código incorrecto o vencido.') }
    }

    setSession(data.session)
    setUser(data.session.user)

    try {
      await syncUserProfile(pending)
      clearPendingRegistration()
    } catch (err) {
      await supabase.auth.signOut()
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'No pudimos guardar tu perfil.',
      }
    }

    return { status: 'success', message: 'Ingreso confirmado. ¡Bienvenido al prode!' }
  }

  const signOut = async () => {
    clearPendingRegistration()
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
      requestAccessCode,
      verifyAccessCode,
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
