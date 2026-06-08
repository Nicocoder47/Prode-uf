import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../lib/auth.tsx'
import { supabase } from '../../lib/supabase.ts'
import {
  getOtpCooldownSeconds,
  normalizeDni,
  normalizeLegajo,
  readPendingLogin,
  readPendingRegistration,
  resetAuthAttempt,
  savePendingLogin,
  savePendingRegistration,
} from '../../utils/registration.ts'
import { AuthField, AuthShell, AuthStatusMessage, type UiStatus } from './AuthShell.tsx'

type AuthMode = 'register' | 'login'
type Step = 'form' | 'code'

export default function LoginPage() {
  const navigate = useNavigate()
  const { requestRegisterCode, verifyRegisterCode, requestLoginCode, verifyLoginCode, devSignIn } =
    useAuth()

  const [mode, setMode] = useState<AuthMode>('register')
  const [step, setStep] = useState<Step>('form')
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [legajo, setLegajo] = useState('')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [status, setStatus] = useState<UiStatus>('idle')
  const [message, setMessage] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  const cleanEmail = email.trim().toLowerCase()
  const normalizedDniPreview = useMemo(() => (dni.trim() ? normalizeDni(dni) : ''), [dni])
  const normalizedLegajoPreview = useMemo(() => (legajo.trim() ? normalizeLegajo(legajo) : ''), [legajo])

  useEffect(() => {
    const pendingRegister = readPendingRegistration()
    const pendingLogin = readPendingLogin()

    if (pendingRegister) {
      setMode('register')
      setFullName(pendingRegister.fullName)
      setDni(pendingRegister.dni)
      setLegajo(pendingRegister.legajo)
      setEmail(pendingRegister.email)
    } else if (pendingLogin) {
      setMode('login')
      setEmail(pendingLogin)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function handleAuthCallback() {
      const params = new URLSearchParams(window.location.search)
      const hasCallback =
        window.location.hash.includes('access_token') ||
        params.has('token_hash') ||
        params.has('code')

      if (!hasCallback) return

      const { data } = await supabase.auth.getSession()
      if (mounted && data.session) {
        navigate('/', { replace: true })
      }
    }

    handleAuthCallback()

    return () => {
      mounted = false
    }
  }, [navigate])

  useEffect(() => {
    const tick = () => setCooldownSeconds(getOtpCooldownSeconds())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [status, step])

  const registrationPayload = () => ({
    fullName: fullName.trim(),
    dni: normalizeDni(dni),
    legajo: normalizeLegajo(legajo),
    email: cleanEmail,
  })

  const goToCodeStep = (infoMessage?: string) => {
    if (mode === 'register' && fullName.trim() && dni.trim() && legajo.trim() && cleanEmail) {
      savePendingRegistration(registrationPayload())
    } else if (mode === 'login' && cleanEmail) {
      savePendingLogin(cleanEmail)
    }

    setStep('code')
    setStatus('pending')
    setMessage(infoMessage ?? 'Ingresá el código que te enviamos por email.')
    setOtpCode('')
  }

  const applyAuthResult = (result: Awaited<ReturnType<typeof requestRegisterCode>>) => {
    if (result.cooldownSeconds) {
      setCooldownSeconds(result.cooldownSeconds)
    }

    if (result.suggestLogin) {
      setMode('login')
    } else if (result.suggestRegister) {
      setMode('register')
    }

    if (result.status === 'pending') {
      goToCodeStep(result.message)
      return
    }

    if (result.continueToCode) {
      goToCodeStep(result.message)
      return
    }

    setStatus(result.status)
    setMessage(result.message)
  }

  const switchMode = (next: AuthMode) => {
    if (next === mode || step === 'code') return
    setMode(next)
    setStatus('idle')
    setMessage('')
  }

  const handleStartOver = () => {
    resetAuthAttempt()
    setStep('form')
    setMode('register')
    setFullName('')
    setDni('')
    setLegajo('')
    setEmail('')
    setOtpCode('')
    setStatus('idle')
    setMessage('')
    setCooldownSeconds(0)
  }

  const handleSubmitForm = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')

    const result =
      mode === 'register'
        ? await requestRegisterCode(registrationPayload())
        : await requestLoginCode(cleanEmail)

    applyAuthResult(result)
  }

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')

    const result =
      mode === 'register'
        ? await verifyRegisterCode(cleanEmail, otpCode.trim())
        : await verifyLoginCode(cleanEmail, otpCode.trim())

    setStatus(result.status)
    setMessage(result.message)

    if (result.status === 'success') {
      setTimeout(() => navigate('/', { replace: true }), 800)
    }
  }

  const handleResend = async () => {
    if (cooldownSeconds > 0) return
    setStatus('loading')
    const result =
      mode === 'register'
        ? await requestRegisterCode(registrationPayload(), { resend: true })
        : await requestLoginCode(cleanEmail, { resend: true })
    applyAuthResult(result)
  }

  const heroSteps =
    mode === 'register'
      ? ['Nombre, DNI, legajo y email', 'Código de confirmación', 'Listo para predecir']
      : ['Email de tu cuenta', 'Código por email', 'Entrás al prode']

  const hasPending = Boolean(readPendingRegistration() || readPendingLogin())

  return (
    <AuthShell
      title="Entrá al Prode"
      subtitle="Un solo link para todos: registrate la primera vez o iniciá sesión si ya tenés cuenta."
      steps={heroSteps}
    >
      {step === 'form' ? (
        <>
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

          <h2 className="wc26-login-heading">
            {mode === 'register' ? 'Crear cuenta' : 'Ya tengo cuenta'}
          </h2>

          <form className="space-y-3" onSubmit={handleSubmitForm}>
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

                <AuthField label="DNI" id="dni" required>
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
                    <p className="mt-1 text-[11px] font-medium text-white/45">
                      DNI: <span className="text-wc26-yellow">{normalizedDniPreview}</span>
                    </p>
                  ) : null}
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
            ) : null}

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
                ? 'Enviando…'
                : mode === 'register'
                  ? 'Registrarme y recibir código'
                  : 'Recibir código de ingreso'}
            </button>

            <button type="button" className="wc26-login-secondary" onClick={() => goToCodeStep()}>
              Ya tengo el código →
            </button>

            <AuthStatusMessage status={status} message={message} />

            {hasPending || status === 'error' ? (
              <button
                type="button"
                onClick={handleStartOver}
                className="w-full pt-1 text-center text-xs font-semibold text-white/40 hover:text-white/70"
              >
                Empezar de cero
              </button>
            ) : null}
          </form>
        </>
      ) : (
        <>
          <button
            type="button"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-white/55 hover:text-white"
            onClick={() => {
              setStep('form')
              setStatus('idle')
              setMessage('')
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </button>

          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/40">
            {mode === 'register' ? 'Registro' : 'Inicio de sesión'}
          </p>

          <h2 className="wc26-login-heading">
            {mode === 'register' ? 'Confirmá tu registro' : 'Ingresá el código'}
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-white/60">
            Código enviado a <span className="font-bold text-white">{email}</span>.
            Revisá también spam o correo no deseado.
          </p>

          <form className="space-y-3" onSubmit={handleVerify}>
            <AuthField label="Código de ingreso" id="otp-code" required>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="000000"
                autoComplete="one-time-code"
                className="wc26-login-input text-center text-2xl font-black tracking-[0.35em]"
                required
              />
            </AuthField>

            <button type="submit" className="wc26-login-primary" disabled={status === 'loading'}>
              {status === 'loading'
                ? 'Verificando…'
                : mode === 'register'
                  ? 'Confirmar registro'
                  : 'Iniciar sesión'}
            </button>

            <button
              type="button"
              className="wc26-login-secondary"
              disabled={status === 'loading' || cooldownSeconds > 0}
              onClick={handleResend}
            >
              {cooldownSeconds > 0 ? `Reenviar en ${cooldownSeconds}s` : 'Reenviar código'}
            </button>

            <AuthStatusMessage status={status} message={message} />

            <button
              type="button"
              onClick={handleStartOver}
              className="w-full pt-1 text-center text-xs font-semibold text-white/40 hover:text-white/70"
            >
              Empezar de cero
            </button>
          </form>
        </>
      )}

      {import.meta.env.DEV && devSignIn && step === 'form' ? (
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
