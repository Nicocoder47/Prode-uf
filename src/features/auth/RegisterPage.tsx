import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../lib/auth.tsx'
import { normalizeDni, normalizeLegajo } from '../../utils/registration.ts'
import { AuthField, AuthShell, AuthStatusMessage, type UiStatus } from './AuthShell.tsx'

type Step = 'form' | 'code'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { requestRegisterCode, verifyRegisterCode, devSignIn } = useAuth()

  const [step, setStep] = useState<Step>('form')
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [legajo, setLegajo] = useState('')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [status, setStatus] = useState<UiStatus>('idle')
  const [message, setMessage] = useState('')

  const normalizedDniPreview = useMemo(() => (dni.trim() ? normalizeDni(dni) : ''), [dni])
  const normalizedLegajoPreview = useMemo(() => (legajo.trim() ? normalizeLegajo(legajo) : ''), [legajo])

  const registrationPayload = () => ({
    fullName: fullName.trim(),
    dni: normalizeDni(dni),
    legajo: normalizeLegajo(legajo),
    email: email.trim().toLowerCase(),
  })

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')

    const result = await requestRegisterCode(registrationPayload())
    setStatus(result.status)
    setMessage(result.message)

    if (result.status === 'pending') {
      setStep('code')
      setOtpCode('')
    }
  }

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')

    const result = await verifyRegisterCode(email.trim().toLowerCase(), otpCode.trim())
    setStatus(result.status)
    setMessage(result.message)

    if (result.status === 'success') {
      setTimeout(() => navigate('/', { replace: true }), 800)
    }
  }

  return (
    <AuthShell
      title="Registrate"
      subtitle="Primera vez en el prode: cargá tus datos y confirmá con el código por email."
      steps={['Nombre, DNI, legajo y email', 'Código de confirmación', 'Listo para predecir']}
      footerLink={{ hint: '¿Ya tenés cuenta?', label: 'Iniciá sesión', to: '/login' }}
    >
      {step === 'form' ? (
        <>
          <h2 className="wc26-login-heading">Crear cuenta</h2>
          <form className="space-y-3" onSubmit={handleRegister}>
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
              {status === 'loading' ? 'Enviando…' : 'Registrarme y recibir código'}
            </button>

            <AuthStatusMessage status={status} message={message} />
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

          <h2 className="wc26-login-heading">Confirmá tu registro</h2>
          <p className="mb-4 text-sm leading-relaxed text-white/60">
            Código enviado a <span className="font-bold text-white">{email}</span>.
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
              {status === 'loading' ? 'Verificando…' : 'Confirmar registro'}
            </button>

            <button
              type="button"
              className="wc26-login-secondary"
              disabled={status === 'loading'}
              onClick={async () => {
                setStatus('loading')
                const result = await requestRegisterCode(registrationPayload())
                setStatus(result.status)
                setMessage(result.message || 'Te enviamos un código nuevo.')
              }}
            >
              Reenviar código
            </button>

            <AuthStatusMessage status={status} message={message} />
          </form>
        </>
      )}

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

      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-white/50">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <span>
          Tu DNI y legajo quedan vinculados a tu cuenta. Código admin <strong className="text-white/70">0047</strong>{' '}
          solo en este paso de confirmación.
        </span>
      </div>
    </AuthShell>
  )
}
