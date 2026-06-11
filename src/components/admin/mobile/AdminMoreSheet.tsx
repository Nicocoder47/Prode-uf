import { NavLink, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { ADMIN_MOBILE_MORE } from '../../../config/adminMobileNav'

type Props = {
  open: boolean
  onClose: () => void
}

export function AdminMoreSheet({ open, onClose }: Props) {
  const { pathname } = useLocation()

  if (!open) return null

  return (
    <div className="admin-more-sheet" role="dialog" aria-modal="true" aria-label="Más secciones admin">
      <button type="button" className="admin-more-sheet__backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="admin-more-sheet__panel">
        <div className="admin-more-sheet__header">
          <p className="admin-more-sheet__title">Más secciones</p>
          <button type="button" className="admin-more-sheet__close" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="admin-more-sheet__grid">
          {ADMIN_MOBILE_MORE.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`)
            return (
              <NavLink
                key={to}
                to={to}
                className={`admin-more-sheet__link${active ? ' is-active' : ''}`}
                onClick={onClose}
              >
                <Icon className="h-5 w-5 text-amber-300/90" strokeWidth={2} />
                <span>{label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
