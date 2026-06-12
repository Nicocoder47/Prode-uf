import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { ADMIN_MOBILE_MORE_TRIGGER, ADMIN_MOBILE_PRIMARY } from '../../../config/adminMobileNav'
import { AdminMoreSheet } from './AdminMoreSheet'

function isPrimaryActive(pathname: string, to: string) {
  if (to === '/admin/dashboard') {
    return pathname === '/admin/dashboard' || pathname === '/admin' || pathname === '/admin/operations'
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AdminMobileBottomNav() {
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const moreActive = ADMIN_MOBILE_MORE_TRIGGER
    ? ['/admin/analytics', '/admin/system', '/admin/beta-capacity', '/admin/support', '/admin/activity', '/admin/notifications', '/admin/scoring-display', '/admin/cards', '/admin/live-cards'].some(
        p => pathname === p || pathname.startsWith(`${p}/`),
      )
    : false

  return (
    <>
      <nav className="admin-mobile-bottom-nav md:hidden" aria-label="Navegación admin">
        {ADMIN_MOBILE_PRIMARY.map(({ to, label, icon: Icon }) => {
          const active = isPrimaryActive(pathname, to)
          return (
            <NavLink
              key={to}
              to={to}
              className={`admin-mobile-bottom-nav__item${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="admin-mobile-bottom-nav__icon" strokeWidth={2.25} />
              <span className="admin-mobile-bottom-nav__label">{label}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          className={`admin-mobile-bottom-nav__item${moreActive ? ' is-active' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-label="Más secciones"
        >
          <ADMIN_MOBILE_MORE_TRIGGER.icon className="admin-mobile-bottom-nav__icon" strokeWidth={2.25} />
          <span className="admin-mobile-bottom-nav__label">{ADMIN_MOBILE_MORE_TRIGGER.label}</span>
        </button>
      </nav>
      <AdminMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
