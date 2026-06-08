import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Mail } from 'lucide-react'
import { SeccionalLogo } from '../../components/brand/SeccionalLogo'

type UiStatus = 'idle' | 'loading' | 'error' | 'pending' | 'success'

type AuthShellProps = {
  title: string
  subtitle: string
  steps: string[]
  children: ReactNode
}

export function AuthShell({ title, subtitle, steps, children }: AuthShellProps) {
  return (
    <div className="wc26-login-page">
      <div className="wc26-login-page__backdrop" aria-hidden="true" />

      <div className="wc26-login-page__layout">
        <header className="wc26-login-page__hero">
          <div className="wc26-login-page__brand">
            <SeccionalLogo size="login" />
          </div>
          <p className="wc26-login-page__kicker">PRODEMUNDIAL 2026</p>
          <h1 className="wc26-login-page__title">{title}</h1>
          <p className="wc26-login-page__subtitle">{subtitle}</p>
          <div className="wc26-login-page__steps">
            {steps.map((label, i) => (
              <div key={label} className="wc26-login-page__step">
                <span className="wc26-login-page__step-num">{i + 1}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </header>

        <section className="wc26-login-form-side w-full max-w-md">
          <div className="wc26-login-panel">{children}</div>
        </section>
      </div>
    </div>
  )
}

export function AuthField({
  label,
  id,
  required,
  children,
}: {
  label: string
  id: string
  required?: boolean
  children: ReactNode
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

export function AuthStatusMessage({ status, message }: { status: UiStatus; message: string }) {
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
          <Mail className="h-4 w-4" /> Revisá tu email
        </div>
      )}
      {message}
      {status === 'success' && (
        <div className="mt-2 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4" /> Listo
        </div>
      )}
    </motion.div>
  )
}

export type { UiStatus }
