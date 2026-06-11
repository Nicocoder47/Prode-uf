import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Mail } from 'lucide-react'
import { SeccionalLogo } from '../../components/layout/SeccionalLogo'

type UiStatus = 'idle' | 'loading' | 'error' | 'pending' | 'success'

type AuthShellProps = {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.muted = true
    const tryPlay = () => {
      void video.play().catch(() => {})
    }

    tryPlay()
    video.addEventListener('loadeddata', tryPlay)
    video.addEventListener('canplay', tryPlay)

    return () => {
      video.removeEventListener('loadeddata', tryPlay)
      video.removeEventListener('canplay', tryPlay)
    }
  }, [])

  return (
    <div className="wc26-login-page">
      <div className="wc26-login-page__backdrop" aria-hidden="true">
        <video
          ref={videoRef}
          className="wc26-login-page__backdrop-video"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/fondo-jugar.png"
        >
          <source src="/videosec.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="wc26-login-page__layout">
        <section className="wc26-login-form-side w-full max-w-md">
          <div className="wc26-login-panel">
            <div className="wc26-login-panel__brand">
              <SeccionalLogo size="md" />
              <p className="wc26-login-panel__kicker">PRODEMUNDIAL 2026</p>
            </div>
            {children}
            <AuthCompatibilityNotice />
          </div>
        </section>
      </div>
    </div>
  )
}

export function AuthCompatibilityNotice() {
  return (
    <aside className="wc26-login-compat" aria-label="Aviso importante de compatibilidad">
      <p className="wc26-login-compat__title">Aviso importante</p>
      <p>
        PRODEMUNDIAL 2026 utiliza tecnologias modernas para ofrecer resultados reales, rankings
        actualizados y estadisticas del Mundial.
      </p>
      <p>
        Para una experiencia optima recomendamos utilizar{' '}
        <strong>Android 13 o superior</strong>, <strong>iPhone con iOS 16 o superior</strong>,{' '}
        <strong>Windows 10 o superior</strong>, <strong>macOS 12 o superior</strong> y las ultimas
        versiones de Chrome, Safari, Edge o Firefox.
      </p>
    </aside>
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
          : 'border-white/20 bg-white/[0.04] text-white/80'

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
