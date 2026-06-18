import { X } from 'lucide-react'
import type { GlobalAppAlert } from '../../types/globalAlert'

type GlobalAppAlertModalProps = {
  alert: GlobalAppAlert
  onDismiss: () => void
}

export function GlobalAppAlertModal({ alert, onDismiss }: GlobalAppAlertModalProps) {
  return (
    <div className="wc26-global-alert" role="dialog" aria-modal="true" aria-labelledby="wc26-global-alert-title">
      <button type="button" className="wc26-global-alert__backdrop" onClick={onDismiss} aria-label="Cerrar aviso" />
      <div className="wc26-global-alert__card">
        <button type="button" className="wc26-global-alert__close" onClick={onDismiss} aria-label="Cerrar">
          <X className="h-4 w-4" aria-hidden />
        </button>
        <p className="wc26-global-alert__kicker">{alert.kicker}</p>
        <h2 id="wc26-global-alert-title" className="wc26-global-alert__title">
          {alert.title}
        </h2>
        {alert.message ? <p className="wc26-global-alert__message">{alert.message}</p> : null}
        <button type="button" className="wc26-global-alert__cta" onClick={onDismiss}>
          Entendido
        </button>
      </div>
    </div>
  )
}
