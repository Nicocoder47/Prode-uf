import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../lib/auth.tsx'
import { normalizeDni, normalizeLegajo } from '../../utils/registration.ts'

type Step = 'form' | 'code'
type UiStatus = 'idle' | 'loading' | 'error' | 'pending' | 'success'

export default function AccessLoginPage() {
  const navigate = useNavigate()
  const { requestAccessCode, verifyAccessCode, devSignIn } = useAuth()

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

  const handleRequestCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')

    const result = await requestAccessCode(registrationPayload())

    setStatus(result.status)
    setMessage(result.message)

    if (result.status === 'pending') {
      setStep('code')
      setOtpCode('')
    }
  }

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')

    const result = await verifyAccessCode(email.trim().toLowerCase(), otpCode.trim())

    setStatus(result.status)
    setMessage(result.message)

    if (result.status === 'success') {
      setTimeout(() => navigate('/', { replace: true }), 800)
    }
  }

  return (
    <div className="wc26-login-page">
      <div className="wc26-login-page__backdrop" aria-hidden="true" />

      <div className="wc26-login-page__layout">
        <header className="wc26-login-page__hero">
          <p className="wc26-login-page__kicker">PRODEMUNDIAL 2026</p>
          <h1 className="wc26-login-page__title">Entrá al Prode</h1>
          <p className="wc26-login-page__subtitle">
            Completá tus datos y recibí un código en tu email. Sin contraseña.
          </p>
          <div className="wc26-login-page__steps">
            {[
              'Nombre completo, DNI y legajo',
              'Código de ingreso por email',
              'Predicciones y ranking en vivo',
            ].map((label, i) => (
              <div key={label} className="wc26-login-page__step">
                <span className="wc26-login-page__step-num">{i + 1}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </header>

        <section className="wc26-login-form-side w-full max-w-md">
          <div className="wc26-login-panel">
            {step === 'form' ? (
              <>
                <h2 className="wc26-login-heading">Datos de acceso</h2>
                <form className="space-y-3" onSubmit={handleRequestCode}>
                  <Field label="Nombre completo" id="full-name" required>
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
                  </Field>

                  <Field label="DNI" id="dni" required>
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
                  </Field>

                  <Field label="Legajo" id="legajo" required>
                    <input
                      id="legajo"
                      type="text"
                      value={legajo}
                      onChange={e => setLegajo(e.target.value.toUpperCase())}
                      placeholder="Ej: 12345"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      className="wc26-login-input font-mono tracking-wider"
                      required
                    />
                    {normalizedLegajoPreview ? (
                      <p className="mt-1 text-[11px] font-medium text-white/45">
                        Legajo: <span className="text-wc26-yellow">{normalizedLegajoPreview}</span>
                      </p>
                    ) : null}
                  </Field>

                  <Field label="Email" id="email" required>
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
                  </Field>

                  <button type="submit" className="wc26-login-primary" disabled={status === 'loading'}>
                    {status === 'loading' ? 'Enviando…' : 'Recibir código de ingreso'}
                  </button>

                  <StatusMessage status={status} message={message} />
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

                <h2 className="wc26-login-heading">Ingresá el código</h2>
                <p className="mb-4 text-sm leading-relaxed text-white/60">
                  Te enviamos un código a <span className="font-bold text-white">{email}</span>.
                  Revisá también spam o correo no deseado.
                </p>

                <form className="space-y-3" onSubmit={handleVerifyCode}>
                  <Field label="Código de ingreso" id="otp-code" required>
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
                  </Field>

                  <button type="submit" className="wc26-login-primary" disabled={status === 'loading'}>
                    {status === 'loading' ? 'Verificando…' : 'Confirmar ingreso'}
                  </button>

                  <button
                    type="button"
                    className="wc26-login-secondary"
                    disabled={status === 'loading'}
                    onClick={async () => {
                      setStatus('loading')
                      const result = await requestAccessCode(registrationPayload())
                      setStatus(result.status)
                      setMessage(result.message || 'Te enviamos un código nuevo.')
                    }}
                  >
                    Reenviar código
                  </button>

                  <StatusMessage status={status} message={message} />
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
              <span>Tu DNI y legajo quedan vinculados a tu cuenta. No compartimos tu email con otros jugadores.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function Field({
  label,
  id,
  required,
  children,
}: {
  label: string
  id: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="wc26-login-label">
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
    </div>
  )
}

function StatusMessage({ status, message }: { status: UiStatus; message: string }) {
  if (status === 'idle' || !message) return null

  const tone =
    status === 'success'
      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
      : status === 'pending'
        ? 'border-sky-400/40 bg-sky-500/15 text-sky-100'
        : status === 'error'
          ? 'border-red-400/40 bg-red-500/15 text-red-100'
          : 'border-white/20 bg-black/25 text-white/80'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}
    >
      {status === 'pending' && (
        <div className="mb-1 flex items-center gap-2 font-semibold">
          <Mail className="h-4 w-4" /> Te enviamos un código a tu email
        </div>
      )}
      {message}
      {status === 'success' && (
        <div className="mt-2 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4" /> Ingreso confirmado
        </div>
      )}
    </motion.div>
  )
}
