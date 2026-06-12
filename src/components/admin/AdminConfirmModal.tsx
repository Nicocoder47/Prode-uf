import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { PremiumButton } from '../ui/PremiumButton'

type Props = {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  confirmPhrase?: string
  confirmValue?: string
  onConfirmValueChange?: (value: string) => void
  reason?: string
  onReasonChange?: (value: string) => void
  reasonRequired?: boolean
  reversible?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function AdminConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  confirmPhrase,
  confirmValue = '',
  onConfirmValueChange,
  reason,
  onReasonChange,
  reasonRequired,
  reversible = false,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null

  const phraseOk = !confirmPhrase || confirmValue === confirmPhrase
  const reasonOk = !reasonRequired || Boolean(reason?.trim())
  const canConfirm = phraseOk && reasonOk && !busy

  return createPortal(
    <div className="admin-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title">
      <button type="button" className="admin-confirm-modal__backdrop" aria-label="Cancelar" onClick={onCancel} />
      <div className="admin-confirm-modal__panel">
        <h3 id="admin-confirm-title" className="admin-confirm-modal__title">
          {title}
        </h3>
        <div className="admin-confirm-modal__body">{description}</div>
        <p className={`admin-confirm-modal__reversible${reversible ? ' is-reversible' : ''}`}>
          {reversible ? 'Esta acción puede revertirse manualmente.' : 'Esta acción no se puede deshacer.'}
        </p>
        {onReasonChange ? (
          <textarea
            rows={2}
            className="admin-confirm-modal__input"
            placeholder={reasonRequired ? 'Motivo obligatorio' : 'Motivo (opcional)'}
            value={reason ?? ''}
            onChange={e => onReasonChange(e.target.value)}
          />
        ) : null}
        {confirmPhrase && onConfirmValueChange ? (
          <>
            <p className="admin-confirm-modal__phrase-hint">
              Escribí <strong>{confirmPhrase}</strong> para confirmar
            </p>
            <input
              className="admin-confirm-modal__input"
              value={confirmValue}
              onChange={e => onConfirmValueChange(e.target.value)}
              placeholder={confirmPhrase}
            />
          </>
        ) : null}
        <div className="admin-confirm-modal__actions">
          <PremiumButton variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </PremiumButton>
          <PremiumButton variant="danger" onClick={onConfirm} disabled={!canConfirm}>
            {busy ? 'Procesando…' : confirmLabel}
          </PremiumButton>
        </div>
      </div>
    </div>,
    document.body,
  )
}
