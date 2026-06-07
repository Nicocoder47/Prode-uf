import { motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Target, Trophy, CalendarDays, Gift } from 'lucide-react'
import { useAuth } from '../../lib/auth.tsx'
import { WC26 } from '../../constants/design'

const BENEFITS = [
  { icon: Target, label: 'Predicciones', color: WC26.redBright },
  { icon: Trophy, label: 'Ranking', color: WC26.yellow },
  { icon: Gift, label: 'Premios', color: WC26.orange },
  { icon: CalendarDays, label: 'Fixture', color: WC26.blueBright },
]

const STEPS = [
  'Ingresá tu código de invitación',
  'Confirmá el magic link en tu email',
  'Jugá el prode del Mundial 2026',
]

export default function InviteLoginPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'pending'>('idle')
  const [message, setMessage] = useState('')
  const { signInWithInviteCode, devSignIn } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('Validando invitación...')

    const result = await signInWithInviteCode(inviteCode)

    setStatus(result.status)
    setMessage(result.message)

    if (result.status === 'success') {
      setTimeout(() => navigate('/'), 900)
    }
  }

  const handleExistingAccount = () => {
    inputRef.current?.focus()
    setMessage('Si ya te registraste, usá el mismo código para recibir el acceso por email.')
    setStatus('idle')
  }

  return (
    <div className="wc26-login-page">
      <div className="wc26-login-page__backdrop" aria-hidden="true" />

      <div className="wc26-login-page__layout">
        <header className="wc26-login-page__hero">
          <p className="wc26-login-page__kicker">PRODEMUNDIAL 2026</p>
          <h1 className="wc26-login-page__title">Entrá a la Liga del Mundial</h1>
          <p className="wc26-login-page__subtitle">
            Prode privado del Mundial. Código de invitación, acceso por email y ranking en vivo.
          </p>
          <div className="wc26-login-page__steps">
            {STEPS.map((step, i) => (
              <div key={step} className="wc26-login-page__step">
                <span className="wc26-login-page__step-num">{i + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </header>

        <section className="wc26-login-form-side w-full max-w-md">
          <div className="wc26-login-panel">
            <LoginForm
              inviteCode={inviteCode}
              setInviteCode={setInviteCode}
              status={status}
              message={message}
              inputRef={inputRef}
              onSubmit={handleSubmit}
              onExistingAccount={handleExistingAccount}
              devSignIn={devSignIn}
              navigate={navigate}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function LoginForm({
  inviteCode,
  setInviteCode,
  status,
  message,
  inputRef,
  onSubmit,
  onExistingAccount,
  devSignIn,
  navigate,
}: {
  inviteCode: string
  setInviteCode: (v: string) => void
  status: 'idle' | 'loading' | 'success' | 'error' | 'pending'
  message: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onExistingAccount: () => void
  devSignIn?: () => void
  navigate: (path: string) => void
}) {
  return (
    <>
      <h2 className="wc26-login-heading">Acceso con invitación</h2>

      <form className="space-y-3" onSubmit={onSubmit}>
        <div>
          <label htmlFor="invite-code" className="wc26-login-label">
            Código de invitación
          </label>
          <input
            ref={inputRef}
            id="invite-code"
            type="text"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            placeholder="ABC123-2026"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="wc26-login-input"
          />
        </div>

        <button type="submit" className="wc26-login-primary" disabled={status === 'loading'}>
          {status === 'loading' ? 'Validando...' : 'Entrar con mi código'}
        </button>

        <button type="button" onClick={onExistingAccount} className="wc26-login-secondary">
          Ya tengo cuenta — reenviar acceso
        </button>

        {import.meta.env.DEV && devSignIn ? (
          <button
            type="button"
            onClick={() => {
              devSignIn()
              navigate('/')
            }}
            className="wc26-login-secondary border-dashed opacity-70"
          >
            Admin (dev)
          </button>
        ) : null}

        {status !== 'idle' && message ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className={`rounded-2xl border px-4 py-3 text-sm ${
              status === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                : status === 'pending'
                  ? 'border-sky-400/40 bg-sky-500/15 text-sky-100'
                  : status === 'error'
                    ? 'border-red-400/40 bg-red-500/15 text-red-100'
                    : 'border-white/20 bg-black/25 text-white/80'
            }`}
          >
            {message}
            {status === 'success' && (
              <div className="mt-2 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Acceso concedido
              </div>
            )}
          </motion.div>
        ) : null}
      </form>

      <div className="wc26-login-benefits">
        {BENEFITS.map(({ icon: Icon, label, color }) => (
          <div key={label} className="wc26-login-benefit">
            <span className="wc26-login-benefit-icon" style={{ backgroundColor: `${color}28`, color }}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="wc26-login-benefit-label">{label}</span>
          </div>
        ))}
      </div>
    </>
  )
}
