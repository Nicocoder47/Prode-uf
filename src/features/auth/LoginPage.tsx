import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth.tsx'
import { supabase } from '../../lib/supabase.ts'
import { normalizeDni, normalizeLegajo, mapSignInError } from '../../utils/registration.ts'
import { AuthField, AuthShell, AuthStatusMessage, type UiStatus } from './AuthShell.tsx'

type AuthMode = 'register' | 'login'

export default function LoginPage() {
  const navigate = useNavigate()
  const { register, login, finalizeSessionProfile, devSignIn } = useAuth()

  const [mode, setMode] = useState<AuthMode>('register')
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [legajo, setLegajo] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<UiStatus>('idle')
  const [message, setMessage] = useState('')

  const cleanEmail = email.trim().toLowerCase()

  useEffect(() => {
    let mounted = true

    async function handleEmailConfirmRedirect() {
      const params = new URLSearchParams(window.location.search)
      const authError = params.get('error_description') ?? params.get('error')

      if (authError) {
        setStatus('error')
        setMessage(decodeURIComponent(authError.replace(/\+/g, ' ')))
        window.history.replaceState({}, document.title, '/login')
        return
      }

      const code = params.get('code')
      if (code) {
        setStatus('loading')
        setMessage('Confirmando tu email…')

        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!mounted) return

        if (error) {
          setStatus('error')
          setMessage(mapSignInError(error.message))
          window.history.replaceState({}, document.title, '/login')
          return
        }

        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) {
          const profileError = await finalizeSessionProfile(sessionData.session)
          if (profileError) {
            setStatus('error')
            setMessage(profileError.message)
            window.history.replaceState({}, document.title, '/login')
            return
          }
        }

        window.history.replaceState({}, document.title, '/login')
        setMode('login')
        setStatus('success')
        setMessage('¡Email confirmado! Ya podés entrar con tu email y DNI.')
        setTimeout(() => navigate('/', { replace: true }), 900)
        return
      }

      if (window.location.hash.includes('access_token')) {
        const { data, error } = await supabase.auth.getSession()
        if (!mounted || error || !data.session) return
        window.history.replaceState({}, document.title, '/login')
        navigate('/', { replace: true })
      }
    }

    handleEmailConfirmRedirect()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted || !session) return
      if (event === 'SIGNED_IN' && (window.location.search.includes('code=') || window.location.hash.includes('access_token'))) {
        window.history.replaceState({}, document.title, '/login')
        navigate('/', { replace: true })
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [navigate])

  const switchMode = (next: AuthMode) => {
    if (next === mode) return
    setMode(next)
    setStatus('idle')
    setMessage('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')

    try {
      const result =
        mode === 'register'
          ? await register({
              fullName: fullName.trim(),
              dni: normalizeDni(dni),
              legajo: normalizeLegajo(legajo),
              email: cleanEmail,
            })
          : await login(cleanEmail, dni)

      if (result.suggestLogin) setMode('login')
      if (result.suggestRegister) setMode('register')

      setStatus(result.status === 'pending' ? 'pending' : result.status)
      setMessage(result.message)

      if (result.status === 'success') {
        setTimeout(() => navigate('/', { replace: true }), 900)
      }
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'No pudimos completar la operación. Intentá de nuevo.')
    }
  }

  const heroSteps =
    mode === 'register'
      ? ['Completá tus datos', 'Confirmá tu email', 'Entrás con email + DNI']
      : ['Tu email', 'Tu DNI (contraseña)', 'Entrás al prode']

  return (
    <AuthShell
      title="Entrá al Prode"
      subtitle={
        mode === 'register'
          ? 'Completá tus datos para jugar el prode.'
          : 'Email y DNI para entrar.'
      }
      steps={heroSteps}
    >
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
        <button
          type="button"
          onClick={() => switchMode('register')}
          className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
            mode === 'register'
              ? 'bg-wc26-red text-white shadow-lg'
              : 'text-white/55 hover:text-white'
          }`}
        >
          Registrarme
        </button>
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
            mode === 'login'
              ? 'bg-wc26-red text-white shadow-lg'
              : 'text-white/55 hover:text-white'
          }`}
        >
          Iniciar sesión
        </button>
      </div>

      <h2 className="wc26-login-heading mb-3">
        {mode === 'register' ? 'Crear cuenta' : 'Ya tengo cuenta'}
      </h2>

      <form className="space-y-2.5" onSubmit={handleSubmit}>
        {mode === 'register' ? (
          <>
            <AuthField label="Nombre completo" id="full-name" required>
              <input
                id="full-name"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                autoComplete="name"
                className="wc26-login-input"
                required
              />
            </AuthField>

            <AuthField label="DNI — será tu contraseña" id="dni" required>
              <input
                id="dni"
                type="text"
                inputMode="numeric"
                value={dni}
                onChange={e => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="Ej: 30123456"
                autoComplete="off"
                className="wc26-login-input font-mono tracking-wider"
                required
              />
            </AuthField>

            <AuthField label="Legajo" id="legajo" required>
              <input
                id="legajo"
                type="text"
                value={legajo}
                onChange={e => setLegajo(e.target.value.toUpperCase())}
                placeholder="Ej: 12345"
                autoComplete="off"
                className="wc26-login-input font-mono tracking-wider"
                required
              />
            </AuthField>
          </>
        ) : (
          <AuthField label="DNI (tu contraseña)" id="dni-login" required>
            <input
              id="dni-login"
              type="password"
              inputMode="numeric"
              value={dni}
              onChange={e => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Tu DNI sin puntos"
              autoComplete="current-password"
              className="wc26-login-input font-mono tracking-wider"
              required
            />
          </AuthField>
        )}

        <AuthField label="Email" id="email" required>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            autoComplete="email"
            className="wc26-login-input"
            required
          />
        </AuthField>

        <button type="submit" className="wc26-login-primary" disabled={status === 'loading'}>
          {status === 'loading'
            ? 'Procesando…'
            : mode === 'register'
              ? 'Registrar'
              : 'Entrar al prode'}
        </button>

        <AuthStatusMessage status={status} message={message} />
      </form>

      {import.meta.env.DEV && devSignIn ? (
        <button
          type="button"
          onClick={() => {
            devSignIn()
            navigate('/')
          }}
          className="wc26-login-secondary mt-3 border-dashed opacity-70"
        >
          Admin (solo dev)
        </button>
      ) : null}
    </AuthShell>
  )
}
