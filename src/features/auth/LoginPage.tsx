import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../lib/auth.tsx'
import { supabase } from '../../lib/supabase.ts'
import { normalizeDni, normalizeLegajo, mapSignInError } from '../../utils/registration.ts'
import { AuthField, AuthShell, AuthStatusMessage, type UiStatus } from './AuthShell.tsx'

type AuthMode = 'register' | 'login'

export default function LoginPage() {
  const navigate = useNavigate()
  const { register, login, devSignIn } = useAuth()

  const [mode, setMode] = useState<AuthMode>('register')
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [legajo, setLegajo] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<UiStatus>('idle')
  const [message, setMessage] = useState('')

  const cleanEmail = email.trim().toLowerCase()
  const normalizedDniPreview = useMemo(() => (dni.trim() ? normalizeDni(dni) : ''), [dni])
  const normalizedLegajoPreview = useMemo(() => (legajo.trim() ? normalizeLegajo(legajo) : ''), [legajo])

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
          ? 'Registrate con email real. Confirmás por mail y después entrás con email + DNI.'
          : 'Ingresá con el email y el DNI con el que te registraste.'
      }
      steps={heroSteps}
    >
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
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

      {mode === 'register' ? (
        <div className="mb-4 space-y-2">
          <div className="flex items-start gap-2.5 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-3.5 py-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <div className="text-xs leading-relaxed text-white/85">
              <p className="font-bold text-sky-200">Confirmación por email</p>
              <p className="mt-1">
                Te mandamos un link para verificar que el email es tuyo. Así evitamos registros falsos.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-2xl border border-wc26-yellow/35 bg-wc26-yellow/10 px-3.5 py-3">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-wc26-yellow" />
            <div className="text-xs leading-relaxed text-white/85">
              <p className="font-bold text-wc26-yellow">Tu DNI es tu contraseña</p>
              <p className="mt-1">
                Después de confirmar el email, entrás siempre con email + DNI (solo números, sin puntos).
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <h2 className="wc26-login-heading">
        {mode === 'register' ? 'Crear cuenta' : 'Ya tengo cuenta'}
      </h2>

      <form className="space-y-3" onSubmit={handleSubmit}>
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
              {normalizedDniPreview ? (
                <p className="mt-1 text-[11px] font-semibold text-wc26-yellow">
                  Contraseña para entrar: {normalizedDniPreview}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-white/45">Solo números, sin puntos ni espacios.</p>
              )}
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
              {normalizedLegajoPreview ? (
                <p className="mt-1 text-[11px] font-medium text-white/45">
                  Legajo: <span className="text-wc26-yellow">{normalizedLegajoPreview}</span>
                </p>
              ) : null}
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
              ? 'Registrarme y confirmar email'
              : 'Entrar al prode'}
        </button>

        <AuthStatusMessage status={status} message={message} />
      </form>

      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-white/50">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <span>
          {mode === 'register'
            ? 'Paso 1: registrate. Paso 2: abrí el mail y confirmá. Paso 3: Iniciar sesión con email + DNI.'
            : '¿No confirmaste el email? Revisá spam. Después entrá con email + DNI.'}
        </span>
      </div>

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
