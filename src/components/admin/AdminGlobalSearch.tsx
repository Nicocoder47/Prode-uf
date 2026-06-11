import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { ADMIN_ALL_NAV } from '../../config/adminMobileNav'
import { useAdminUsers } from '../../hooks/useAdminQueries'

type Props = {
  compact?: boolean
}

export function AdminGlobalSearch({ compact }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { data: users = [] } = useAdminUsers()

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return { sections: [], users: [], matches: [] as never[] }

    const sections = ADMIN_ALL_NAV.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.searchTerms?.some(t => t.includes(q) || q.includes(t)),
    )

    const matchedUsers = users
      .filter(u => {
        const hay = [u.full_name, u.email, u.legajo, u.dni_masked].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 8)

    return { sections, users: matchedUsers }
  }, [query, users])

  function goUser(id: string) {
    setOpen(false)
    navigate(`/admin/users?userId=${id}`)
  }

  return (
    <>
      <button
        type="button"
        className={`admin-global-search-trigger${compact ? ' admin-global-search-trigger--compact' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Búsqueda global admin"
      >
        <Search className="h-4 w-4" />
        {!compact && <span>Buscar…</span>}
      </button>

      {open ? (
        <div className="admin-global-search" role="dialog" aria-modal="true" aria-label="Búsqueda global">
          <button type="button" className="admin-global-search__backdrop" aria-label="Cerrar" onClick={() => setOpen(false)} />
          <div className="admin-global-search__panel">
            <div className="admin-global-search__header">
              <Search className="h-5 w-5 text-amber-300/80" />
              <input
                autoFocus
                className="admin-global-search__input"
                placeholder="Buscar usuario, email, partido, selección, ticket…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button type="button" className="admin-global-search__close" onClick={() => setOpen(false)} aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            {query.trim().length < 2 ? (
              <p className="admin-global-search__hint">Escribí al menos 2 caracteres</p>
            ) : (
              <div className="admin-global-search__results">
                {results.sections.length > 0 && (
                  <section>
                    <p className="admin-global-search__group">Secciones admin</p>
                    <ul className="admin-global-search__list">
                      {results.sections.map(s => (
                        <li key={s.to}>
                          <Link to={s.to} className="admin-global-search__link" onClick={() => setOpen(false)}>
                            {s.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {results.users.length > 0 && (
                  <section>
                    <p className="admin-global-search__group">Usuarios</p>
                    <ul className="admin-global-search__list">
                      {results.users.map(u => (
                        <li key={u.id}>
                          <button type="button" className="admin-global-search__link" onClick={() => goUser(u.id)}>
                            <span className="font-semibold">{u.full_name}</span>
                            <span className="text-white/50">{u.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {results.sections.length === 0 && results.users.length === 0 && (
                  <p className="admin-global-search__empty">Sin resultados para «{query}»</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
