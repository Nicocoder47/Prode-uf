import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface Profile {
  id: string
  email: string
  full_name: string
  role: string
  token_balance: number
  is_active: boolean
}

interface InviteResult {
  status: 'success' | 'pending' | 'error'
  message: string
  email?: string
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signInWithInviteCode: (inviteCode: string) => Promise<InviteResult>
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
      // eslint-disable-next-line no-console
      console.warn('[DEV_ADMIN] No se pudo autenticar en Supabase:', error.message)
      return null
    }
    return data.session
  }

  useEffect(() => {
    let mounted = true

    async function initSession() {
      const { data } = await supabase.auth.getSession()
      if (mounted) {
        setSession(data.session)
        setUser(data.session?.user ?? null)
        if (!data.session && DEV_ADMIN) {
          const devSession = await ensureDevSupabaseSession()
          if (devSession) {
            setSession(devSession)
            setUser(devSession.user)
          } else {
            const fakeUser = { id: 'dev-admin', email: DEV_ADMIN_EMAIL } as unknown as User
            setUser(fakeUser)
            const fakeSession = { user: fakeUser } as unknown as Session
            setSession(fakeSession)
            setProfile({
              id: 'dev-admin',
              email: DEV_ADMIN_EMAIL,
              full_name: 'Dev Admin',
              role: 'admin',
              token_balance: 999999,
              is_active: true,
            })
          }
        }

        setLoading(false)
      }
    }

    initSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }

    let mounted = true

    async function fetchProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, token_balance, is_active')
        .eq('id', user.id)
        .single()

      if (mounted) {
        if (!error && data) {
          setProfile(data)
        }
      }
    }

    fetchProfile()

    return () => {
      mounted = false
    }
  }, [user])

  const signInWithInviteCode = async (inviteCode: string): Promise<InviteResult> => {
    const cleanCode = inviteCode.trim()
    if (!cleanCode) {
      return { status: 'error', message: 'Ingresa un código de invitación válido.' }
    }

    const { data, error } = await supabase.rpc('validate_invite_code', { invite_code: cleanCode })
    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return { status: 'error', message: error?.message ?? 'Código inválido o expirado.' }
    }

    const email = data[0]?.email
    if (!email) {
      return { status: 'error', message: 'No se pudo recuperar el email de la invitación.' }
    }

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/invite`,
      },
    })

    if (authError) {
      return { status: 'error', message: authError.message }
    }

    return {
      status: 'pending',
      message: `Acceso concedido. Revisa tu email (${email}) para continuar.`,
      email,
    }
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
      return
    }
    const fakeUser = { id: 'dev-admin', email: DEV_ADMIN_EMAIL } as unknown as User
    const fakeSession = { user: fakeUser } as unknown as Session
    setUser(fakeUser)
    setSession(fakeSession)
    setProfile({
      id: 'dev-admin',
      email: DEV_ADMIN_EMAIL,
      full_name: 'Dev Admin',
      role: 'admin',
      token_balance: 999999,
      is_active: true,
    })
  }

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      signInWithInviteCode,
      signOut,
      devSignIn,
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
