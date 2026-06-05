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
  { icon: CalendarDays, label: 'Fixture real', color: WC26.blueBright },
]

function TrophyMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 140" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="loginTrophyGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD447" />
          <stop offset="100%" stopColor="#F8B91E" />
        </linearGradient>
      </defs>
      <path
        d="M38 48 C38 28 48 18 60 18 C72 18 82 28 82 48 L82 72 C82 88 72 98 60 98 C48 98 38 88 38 72 Z"
        fill="url(#loginTrophyGold)"
      />
      <path d="M38 52 C28 52 22 58 22 66 C22 74 28 80 38 80" fill="none" stroke="url(#loginTrophyGold)" strokeWidth="6" strokeLinecap="round" />
      <path d="M82 52 C92 52 98 58 98 66 C98 74 92 80 82 80" fill="none" stroke="url(#loginTrophyGold)" strokeWidth="6" strokeLinecap="round" />
      <rect x="48" y="98" width="24" height="14" rx="2" fill="url(#loginTrophyGold)" />
      <rect x="40" y="112" width="40" height="10" rx="3" fill={WC26.blue} />
    </svg>
  )
}

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
    setMessage('Si ya te registraste, ingresá tu código de invitación para entrar.')
    setStatus('idle')
  }

  return (
    <div className="min-h-screen bg-wc26-gray50 text-wc26-text">
      {/* Mobile + tablet: mural arriba, hoja blanca abajo */}
      <div className="md:hidden">
        <div className="wc26-hero-mural px-5 pb-16 pt-10 text-center">
          <TrophyMark className="mx-auto mb-4 h-20 w-16 drop-shadow-lg" />
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/90">PRODEMUNDIAL 2026</p>
          <h1
            className="mt-2 font-extrabold leading-tight text-white drop-shadow-sm"
            style={{ fontSize: 'clamp(1.75rem, 8vw, 2.25rem)' }}
          >
            Entrá a la Liga del Mundial
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-base font-medium text-white/90">
            Usá tu código privado para participar
          </p>
        </div>

        <div className="wc26-content-sheet -mt-6 px-5 pb-10 pt-8">
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
      </div>

      {/* Desktop */}
      <div className="mx-auto hidden min-h-screen max-w-5xl items-center gap-0 px-8 py-12 md:grid md:grid-cols-2">
        <div className="wc26-hero-mural flex min-h-[520px] flex-col items-center justify-center rounded-[32px] p-10 text-center">
          <TrophyMark className="mb-6 h-28 w-24 drop-shadow-lg" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/90">PRODEMUNDIAL 2026</p>
          <h1 className="mt-3 text-4xl font-extrabold text-white">Entrá a la Liga del Mundial</h1>
          <p className="mt-4 max-w-sm text-lg font-medium text-white/90">Usá tu código privado para participar</p>
        </div>
        <div className="flex flex-col justify-center rounded-[32px] bg-white p-10 shadow-wc26-card">
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
      <form className="space-y-4" onSubmit={onSubmit}>
        <label htmlFor="invite-code" className="wc26-section-title block">
          Código de invitación
        </label>
        <input
          ref={inputRef}
          id="invite-code"
          type="text"
          value={inviteCode}
          onChange={e => setInviteCode(e.target.value)}
          placeholder="ABC123-2026"
          className="w-full rounded-[20px] border border-wc26-gray300/80 bg-wc26-gray50 px-5 py-4 text-lg font-semibold text-wc26-text placeholder:text-wc26-text/35 focus:border-wc26-blueBright focus:outline-none focus:ring-4 focus:ring-wc26-blueBright/15"
        />

        <button type="submit" className="wc26-btn-red w-full py-4 text-sm" disabled={status === 'loading'}>
          {status === 'loading' ? 'Validando...' : 'Entrar'}
        </button>

        <button type="button" onClick={onExistingAccount} className="wc26-btn-white w-full py-4 text-sm">
          Ya tengo cuenta
        </button>

        {import.meta.env.DEV && devSignIn ? (
          <button
            type="button"
            onClick={() => {
              devSignIn()
              navigate('/')
            }}
            className="w-full rounded-full border border-dashed border-wc26-blue/30 py-3 text-xs font-semibold text-wc26-blue/60"
          >
            Entrar como Admin (dev)
          </button>
        ) : null}

        {status !== 'idle' && message ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-[20px] px-4 py-4 text-sm ${
              status === 'success'
                ? 'bg-wc26-greenBright/10 text-wc26-green'
                : status === 'pending'
                  ? 'bg-wc26-blueBright/10 text-wc26-blue'
                  : status === 'error'
                    ? 'bg-wc26-redBright/10 text-wc26-red'
                    : 'bg-wc26-gray100 text-wc26-text/70'
            }`}
          >
            {message}
            {status === 'success' && (
              <div className="mt-2 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" /> Acceso concedido
              </div>
            )}
            {status === 'pending' && (
              <p className="mt-2 text-wc26-text/60">Revisá tu email para completar el acceso.</p>
            )}
          </motion.div>
        ) : null}
      </form>

      <div className="wc26-card mt-8 p-5">
        <p className="wc26-section-title mb-4">Qué incluye tu acceso</p>
        <div className="grid grid-cols-2 gap-3">
          {BENEFITS.map(({ icon: Icon, label, color }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl bg-wc26-gray50 px-3 py-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: `${color}18`, color }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-bold text-wc26-text">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
