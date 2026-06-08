import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../lib/auth.tsx'
import { AuthField, AuthShell, AuthStatusMessage, type UiStatus } from './AuthShell.tsx'

type Step = 'form' | 'code'

export default function LoginPage() {
  const navigate = useNavigate()
  const { requestLoginCode, verifyLoginCode } = useAuth()

  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [status, setStatus] = useState<UiStatus>('idle')
  const [message, setMessage] = useState('')

  const cleanEmail = email.trim().toLowerCase()

  const handleRequestCode = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')

    const result = await requestLoginCode(cleanEmail)
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

    const result = await verifyLoginCode(cleanEmail, otpCode.trim())
    setStatus(result.status)
    setMessage(result.message)

    if (result.status === 'success') {
      setTimeout(() => navigate('/', { replace: true }), 800)
    }
  }

  return (
    <AuthShell
      title="Iniciá sesión"
      subtitle="Si ya te registraste, ingresá tu email y el código que te enviamos."
      steps={['Email de tu cuenta', 'Código por email', 'Entrás al prode']}
      footerLink={{ hint: '¿Primera vez?', label: 'Registrate', to: '/registro' }}
    >
      {step === 'form' ? (
        <>
          <h2 className="wc26-login-heading">Logueate</h2>
          <form className="space-y-3" onSubmit={handleRequestCode}>
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
              {status === 'loading' ? 'Enviando…' : 'Recibir código de ingreso'}
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

          <h2 className="wc26-login-heading">Ingresá el código</h2>
          <p className="mb-4 text-sm leading-relaxed text-white/60">
            Te enviamos un código a <span className="font-bold text-white">{email}</span>.
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
              {status === 'loading' ? 'Verificando…' : 'Iniciar sesión'}
            </button>

            <button
              type="button"
              className="wc26-login-secondary"
              disabled={status === 'loading'}
              onClick={async () => {
                setStatus('loading')
                const result = await requestLoginCode(cleanEmail)
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

      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-white/50">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <span>
          ¿No tenés cuenta?{' '}
          <Link to="/registro" className="font-bold text-wc26-yellow hover:underline">
            Registrate acá
          </Link>
        </span>
      </div>
    </AuthShell>
  )
}
