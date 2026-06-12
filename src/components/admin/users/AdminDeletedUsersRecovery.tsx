import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react'
import { useAppToast } from '../../ui/ToastProvider'
import { useAdminDeletedUsers, useInvalidateAdmin } from '../../../hooks/useAdminQueries'
import { adminRestoreDeletedUser } from '../../../services/admin/adminService'
import type { AdminDeletedUserRow } from '../../../types/admin'

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function snapshotField(row: AdminDeletedUserRow, key: string): string {
  const snap = row.profile_snapshot
  if (!snap || typeof snap !== 'object') return ''
  const value = snap[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

type RestoreForm = {
  fullName: string
  dni: string
  legajo: string
}

function DeletedUserRow({
  row,
  busy,
  form,
  expanded,
  onToggle,
  onPatch,
  onRestore,
}: {
  row: AdminDeletedUserRow
  busy: boolean
  form: RestoreForm
  expanded: boolean
  onToggle: () => void
  onPatch: (patch: Partial<RestoreForm>) => void
  onRestore: () => void
}) {
  const name = form.fullName || snapshotField(row, 'full_name') || row.deleted_email

  return (
    <article className="admin-deleted-users-row">
      <div className="admin-deleted-users-row__main">
        <div className="admin-deleted-users-row__info">
          <p className="admin-deleted-users-row__name">{name}</p>
          <p className="admin-deleted-users-row__sub">{row.deleted_email}</p>
          <p className="admin-deleted-users-row__meta">Eliminado {formatDate(row.deleted_at)}</p>
        </div>
        <span className={`admin-deleted-users-row__badge${row.has_snapshot ? '' : ' admin-deleted-users-row__badge--warn'}`}>
          {row.has_snapshot ? 'Respaldo' : 'Sin respaldo'}
        </span>
        {!row.has_snapshot && (
          <button type="button" className="admin-deleted-users-row__expand" onClick={onToggle} aria-label="Editar datos">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
        <button
          type="button"
          className="admin-deleted-users-row__restore"
          disabled={busy}
          onClick={onRestore}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Recuperar
        </button>
      </div>

      {!row.has_snapshot && expanded && (
        <div className="admin-deleted-users-row__fields">
          <input value={form.fullName} onChange={e => onPatch({ fullName: e.target.value })} placeholder="Nombre completo" />
          <input value={form.legajo} onChange={e => onPatch({ legajo: e.target.value })} placeholder="Legajo" />
          <input value={form.dni} onChange={e => onPatch({ dni: e.target.value })} placeholder="DNI" />
        </div>
      )}
    </article>
  )
}

export function AdminDeletedUsersRecovery() {
  const { data: rows = [], isLoading, error, refetch } = useAdminDeletedUsers()
  const { invalidateUsers, invalidateDeletedUsers, invalidateBetaOverview, invalidateDashboard } = useInvalidateAdmin()
  const { showToast } = useAppToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, RestoreForm>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pending = useMemo(
    () => rows.filter(r => !r.restored_at && !r.profile_exists),
    [rows],
  )

  function getForm(row: AdminDeletedUserRow): RestoreForm {
    return forms[row.audit_id] ?? {
      fullName: snapshotField(row, 'full_name'),
      dni: snapshotField(row, 'dni'),
      legajo: snapshotField(row, 'legajo'),
    }
  }

  function patchForm(row: AdminDeletedUserRow, patch: Partial<RestoreForm>) {
    setForms(prev => {
      const current = prev[row.audit_id] ?? {
        fullName: snapshotField(row, 'full_name'),
        dni: snapshotField(row, 'dni'),
        legajo: snapshotField(row, 'legajo'),
      }
      return { ...prev, [row.audit_id]: { ...current, ...patch } }
    })
  }

  async function restore(row: AdminDeletedUserRow) {
    const form = getForm(row)
    setBusyId(row.audit_id)
    try {
      const result = await adminRestoreDeletedUser(row.audit_id, form)
      showToast(`${result.full_name} recuperado. Debe restablecer contraseña.`)
      invalidateUsers()
      invalidateDeletedUsers()
      invalidateBetaOverview()
      invalidateDashboard()
      await refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo recuperar')
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) {
    return <p className="admin-deleted-users-panel__hint">Cargando eliminaciones…</p>
  }

  if (error) {
    return (
      <p className="admin-deleted-users-panel__hint admin-deleted-users-panel__hint--error">
        {error instanceof Error ? error.message : 'Error al cargar audit log'}
      </p>
    )
  }

  if (!pending.length) {
    return (
      <div className="admin-users-empty-premium">
        <p className="admin-users-empty-premium__title">Sin usuarios para recuperar</p>
        <p className="admin-users-empty-premium__hint">No hay eliminaciones recientes pendientes.</p>
      </div>
    )
  }

  return (
    <div className="admin-deleted-users-panel">
      <p className="admin-deleted-users-panel__hint">
        Restaura la cuenta en la base. Predicciones y puntaje previos no vuelven.
      </p>
      <div className="admin-deleted-users-list">
        {pending.map(row => (
          <DeletedUserRow
            key={row.audit_id}
            row={row}
            busy={busyId === row.audit_id}
            form={getForm(row)}
            expanded={expandedId === row.audit_id}
            onToggle={() => setExpandedId(id => (id === row.audit_id ? null : row.audit_id))}
            onPatch={patch => patchForm(row, patch)}
            onRestore={() => void restore(row)}
          />
        ))}
      </div>
    </div>
  )
}

export function useAdminDeletedUsersPendingCount() {
  const { data: rows = [] } = useAdminDeletedUsers()
  return useMemo(
    () => rows.filter(r => !r.restored_at && !r.profile_exists).length,
    [rows],
  )
}
