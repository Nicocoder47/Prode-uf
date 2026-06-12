import { createPortal } from 'react-dom'
import type { AdminUserRow } from '../../../types/admin'
import { AdminUserDetailPanel } from './AdminUserDetailPanel'

type Props = {
  user: AdminUserRow
  onClose: () => void
  onChanged: () => void
}

export function AdminUserDetailSheet({ user, onClose, onChanged }: Props) {
  return createPortal(
    <div className="admin-user-detail-sheet" role="dialog" aria-modal="true" aria-label="Detalle de usuario">
      <button type="button" className="admin-user-detail-sheet__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="admin-user-detail-sheet__panel">
        <AdminUserDetailPanel user={user} onClose={onClose} onChanged={onChanged} variant="sheet" />
      </div>
    </div>,
    document.body,
  )
}
