import { useState } from 'react'
import { PremiumButton } from '../../components/ui/PremiumButton.tsx'
import { useAppToast } from '../../components/ui/ToastProvider.tsx'
import {
  adminApproveUser,
  adminBlockUser,
  adminCreateNotification,
  adminDeleteTestUser,
  adminDeleteUserFull,
  adminForcePasswordChange,
  adminRejectUser,
  adminResetUserPredictions,
  adminResetUserScore,
  adminSetUserRole,
  adminSoftDeleteUser,
  adminUnblockUser,
} from '../../services/admin/adminService.ts'
import { useAdminUserDetail, useInvalidateAdmin } from '../../hooks/useAdminQueries.ts'
import type { AdminUserRow } from '../../types/admin.ts'
import { isTestUserEmail } from '../../utils/adminTestUser.ts'
import { REVIEW_STATUS_CLASS, REVIEW_STATUS_LABEL } from '../../utils/reviewStatus.ts'

type Tab = 'predictions' | 'activity' | 'notifications'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function accountStatus(u: AdminUserRow) {
  if (u.deleted_at) return 'Eliminado'
  if (!u.is_active) return 'Bloqueado'
  return 'Activo'
}

interface Props {
  user: AdminUserRow
  onClose: () => void
  onChanged: () => void
}

export function AdminUserDetailDrawer({ user, onClose, onChanged }: Props) {
  const { data: detail, isLoading, error: queryError, refetch } = useAdminUserDetail(user.id)
  const { invalidateUserDetail, invalidateBetaOverview, invalidateDashboard, invalidateUsers } = useInvalidateAdmin()
  const { showToast } = useAppToast()

  const [tab, setTab] = useState<Tab>('predictions')
  const [actionReason, setActionReason] = useState('')
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [deactivateConfirm, setDeactivateConfirm] = useState('')
  const [showPromote, setShowPromote] = useState(false)
  const [promoteConfirm, setPromoteConfirm] = useState('')
  const [showDeleteTest, setShowDeleteTest] = useState(false)
  const [showDeleteFull, setShowDeleteFull] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteReason, setDeleteReason] = useState('')

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
      invalidateUserDetail(user.id)
      invalidateUsers()
      invalidateBetaOverview()
      invalidateDashboard()
      await refetch()
      setActionReason('')
      setNotifyTitle('')
      setNotifyMessage('')
      showToast(successMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  const u = detail?.user ?? user
  const padron = detail?.padron ?? null
  const displayError = error ?? (queryError instanceof Error ? queryError.message : null)
  const isTest = u.is_test_user ?? isTestUserEmail(u.email)

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-white/10 bg-wc26-navy shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">Detalle de usuario</p>
            <h2 className="text-xl font-extrabold text-white">{u.full_name}</h2>
            <p className="text-sm text-white/60">{u.email} · {u.legajo ?? '—'}</p>
          </div>
          <PremiumButton size="sm" variant="ghost" onClick={onClose}>Cerrar</PremiumButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {displayError && <p className="rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-200">{displayError}</p>}
          {isLoading && <p className="text-white/60">Cargando detalle…</p>}

          <div className="flex flex-wrap items-center gap-2">
            <span className={REVIEW_STATUS_CLASS[u.review_status ?? 'pending']}>
              {REVIEW_STATUS_LABEL[u.review_status ?? 'pending']}
            </span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">{accountStatus(u)}</span>
            <span className="text-xs text-white/50">Rol: {u.role}</span>
            <span className={`text-xs ${u.must_change_password ? 'text-amber-300' : 'text-emerald-300'}`}>
              {u.must_change_password ? 'Debe cambiar contraseña' : 'Contraseña actualizada'}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Datos declarados</p>
              <ul className="space-y-1 text-sm text-white/85">
                <li><strong>Nombre:</strong> {u.full_name}</li>
                <li><strong>Legajo:</strong> {u.legajo ?? '—'}</li>
                <li><strong>DNI:</strong> {u.dni_masked}</li>
                <li><strong>Email:</strong> {u.email}</li>
                <li><strong>Registro:</strong> {formatDate(u.created_at)}</li>
                <li><strong>Último login:</strong> {formatDate(u.last_login_at)}</li>
                <li><strong>Motivo revisión:</strong> {u.review_reason ?? '—'}</li>
              </ul>
            </div>
            <div className={`rounded-2xl border p-4 ${padron ? 'border-white/10 bg-white/[0.04] backdrop-blur-xl' : 'border-red-400/30 bg-red-500/10'}`}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Padrón de referencia</p>
              {padron ? (
                <ul className="space-y-1 text-sm text-white/85">
                  <li><strong>Apellido:</strong> {padron.last_name ?? '—'}</li>
                  <li><strong>Nombre:</strong> {padron.first_name ?? '—'}</li>
                  <li><strong>Completo:</strong> {padron.full_name ?? '—'}</li>
                  <li><strong>DNI padrón:</strong> {padron.dni ? `****${String(padron.dni).slice(-4)}` : '—'}</li>
                </ul>
              ) : (
                <p className="text-sm font-semibold text-red-300">DNI no encontrado en padrón de referencia</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] uppercase text-white/50">Pts</p>
              <p className="font-bold text-wc26-yellow">{u.total_points}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] uppercase text-white/50">Predicciones</p>
              <p className="font-bold text-white">{u.predictions_count}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] uppercase text-white/50">Exactas</p>
              <p className="font-bold text-white">{u.exact_predictions ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] uppercase text-white/50">Aciertos</p>
              <p className="font-bold text-white">{u.hit_predictions ?? 0}</p>
            </div>
          </div>

          <div className="flex gap-1 border-b border-white/10">
            {(['predictions', 'activity', 'notifications'] as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                className={`px-3 py-2 text-xs font-bold uppercase tracking-wider ${tab === t ? 'border-b-2 border-wc26-yellow text-white' : 'text-white/50'}`}
                onClick={() => setTab(t)}
              >
                {t === 'predictions' ? 'Predicciones' : t === 'activity' ? 'Movimientos' : 'Notificaciones'}
              </button>
            ))}
          </div>

          {tab === 'predictions' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="py-2 pr-2">Partido</th>
                    <th className="py-2 pr-2">Predicho</th>
                    <th className="py-2 pr-2">Resultado</th>
                    <th className="py-2 pr-2">Pts</th>
                    <th className="py-2">Carga</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail?.predictions ?? []).length ? (
                    detail!.predictions.map(p => (
                      <tr key={p.id} className="border-b border-white/5">
                        <td className="py-2 pr-2 text-white">{p.home_team ?? '?'} vs {p.away_team ?? '?'}</td>
                        <td className="py-2 pr-2 font-mono">{p.predicted_score_home ?? '—'} - {p.predicted_score_away ?? '—'}</td>
                        <td className="py-2 pr-2 font-mono text-white/70">
                          {p.result_home != null ? `${p.result_home} - ${p.result_away}` : '—'}
                        </td>
                        <td className="py-2 pr-2 font-bold text-wc26-yellow">{p.points}</td>
                        <td className="py-2 text-white/50">{formatDate(p.created_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="py-4 text-white/50">Sin predicciones</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-2">
              {(detail?.activity ?? []).length ? (
                detail!.activity.map(a => (
                  <div key={a.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-white">{a.title}</span>
                      <span className="text-[10px] uppercase text-wc26-yellow">{a.type}</span>
                    </div>
                    <p className="text-xs text-white/50">{formatDate(a.created_at)}</p>
                    {a.description && <p className="mt-1 text-xs text-white/70">{a.description}</p>}
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/50">Sin movimientos</p>
              )}
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-2">
              {(detail?.notifications ?? []).length ? (
                detail!.notifications.map(n => (
                  <div key={n.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-white">{n.title}</span>
                      <span className={`text-[10px] uppercase ${n.is_read ? 'text-white/40' : 'text-wc26-yellow'}`}>
                        {n.is_read ? 'Leída' : 'No leída'}
                      </span>
                    </div>
                    <p className="text-xs text-white/70">{n.message}</p>
                    <p className="text-xs text-white/40">{formatDate(n.created_at)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/50">Sin notificaciones</p>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
            <label className="block text-xs font-bold uppercase text-white/50">Motivo / notas</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white backdrop-blur-xl"
              placeholder="Motivo de la acción (opcional)"
              value={actionReason}
              onChange={e => setActionReason(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <PremiumButton size="sm" disabled={busy} onClick={() => runAction(() => adminApproveUser(u.id, actionReason || 'Aprobado manualmente'), 'Usuario aprobado')}>
                Aprobar
              </PremiumButton>
              <PremiumButton size="sm" variant="danger" disabled={busy} onClick={() => runAction(() => adminRejectUser(u.id, actionReason || 'Rechazado por admin'), 'Usuario rechazado')}>
                Rechazar
              </PremiumButton>
              {!u.deleted_at && !u.is_blocked && (
                <PremiumButton size="sm" variant="danger" disabled={busy} onClick={() => runAction(() => adminBlockUser(u.id, actionReason || 'Bloqueado por admin'), 'Usuario bloqueado')}>
                  Bloquear
                </PremiumButton>
              )}
              {!u.deleted_at && u.is_blocked && (
                <PremiumButton size="sm" disabled={busy} onClick={() => runAction(() => adminUnblockUser(u.id), 'Usuario desbloqueado')}>
                  Desbloquear
                </PremiumButton>
              )}
              <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={() => runAction(() => adminForcePasswordChange(u.id), 'Cambio de contraseña forzado')}>
                Forzar cambio clave
              </PremiumButton>
              <PremiumButton size="sm" variant="danger" disabled={busy} onClick={() => setShowDeactivate(true)}>
                Desactivar (soft)
              </PremiumButton>
              <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={() => runAction(async () => { await adminResetUserPredictions(u.id) }, 'Predicciones reseteadas')}>
                Reset predicciones
              </PremiumButton>
              <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={() => runAction(async () => { await adminResetUserScore(u.id) }, 'Puntaje reseteado')}>
                Reset puntaje
              </PremiumButton>
              <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={() => (u.role === 'admin' ? runAction(() => adminSetUserRole(u.id, 'member'), 'Rol actualizado') : setShowPromote(true))}>
                {u.role === 'admin' ? 'Quitar admin' : 'Promover admin'}
              </PremiumButton>
              {isTest && u.role !== 'admin' && (
                <PremiumButton size="sm" variant="danger" disabled={busy} onClick={() => setShowDeleteTest(true)}>
                  Eliminar usuario de prueba
                </PremiumButton>
              )}
              {u.role !== 'admin' && (
                <PremiumButton size="sm" variant="danger" disabled={busy} onClick={() => setShowDeleteFull(true)}>
                  Eliminar definitivamente
                </PremiumButton>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
            <p className="text-xs font-bold uppercase text-white/50">Notificación personal</p>
            <input className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white backdrop-blur-xl" placeholder="Título" value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} />
            <textarea rows={2} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white backdrop-blur-xl" placeholder="Mensaje" value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} />
            <PremiumButton size="sm" disabled={busy || !notifyTitle.trim() || !notifyMessage.trim()} onClick={() => runAction(() => adminCreateNotification({ title: notifyTitle, message: notifyMessage, targetType: 'user', targetUserId: u.id }), 'Notificación enviada')}>
              Enviar
            </PremiumButton>
          </div>
          {showDeactivate && (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 space-y-2">
              <p className="text-sm font-bold text-red-100">Desactivar usuario (soft delete)</p>
              <p className="text-xs text-red-100/80">Se conserva historial por auditoría. Escribí DESACTIVAR para confirmar.</p>
              <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={deactivateConfirm} onChange={e => setDeactivateConfirm(e.target.value)} placeholder="DESACTIVAR" />
              <div className="flex gap-2">
                <PremiumButton size="sm" variant="danger" disabled={busy || deactivateConfirm !== 'DESACTIVAR' || !actionReason.trim()} onClick={() => runAction(async () => { await adminSoftDeleteUser(u.id, actionReason); setShowDeactivate(false); setDeactivateConfirm('') }, 'Usuario desactivado')}>
                  Confirmar desactivación
                </PremiumButton>
                <PremiumButton size="sm" variant="ghost" onClick={() => setShowDeactivate(false)}>Cancelar</PremiumButton>
              </div>
            </div>
          )}

          {showPromote && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 space-y-2">
              <p className="text-sm font-bold text-amber-100">Promover a administrador</p>
              <p className="text-xs text-amber-100/80">Escribí PROMOVER ADMIN para confirmar.</p>
              <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={promoteConfirm} onChange={e => setPromoteConfirm(e.target.value)} placeholder="PROMOVER ADMIN" />
              <div className="flex gap-2">
                <PremiumButton size="sm" disabled={busy || promoteConfirm !== 'PROMOVER ADMIN'} onClick={() => runAction(async () => { await adminSetUserRole(u.id, 'admin'); setShowPromote(false); setPromoteConfirm('') }, 'Promovido a admin')}>
                  Confirmar
                </PremiumButton>
                <PremiumButton size="sm" variant="ghost" onClick={() => setShowPromote(false)}>Cancelar</PremiumButton>
              </div>
            </div>
          )}

          {showDeleteTest && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 space-y-2">
              <p className="text-sm font-bold text-amber-100">Eliminar usuario de prueba</p>
              <p className="text-xs text-amber-100/80">
                Se borrará <strong>{u.email}</strong> y todos sus datos. Escribí ELIMINAR_TEST para confirmar.
              </p>
              <input className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="ELIMINAR_TEST" />
              <div className="flex gap-2">
                <PremiumButton
                  size="sm"
                  variant="danger"
                  disabled={busy || deleteConfirm !== 'ELIMINAR_TEST'}
                  onClick={() =>
                    runAction(async () => {
                      await adminDeleteTestUser(u.id)
                      setShowDeleteTest(false)
                      setDeleteConfirm('')
                      onClose()
                    }, 'Usuario de prueba eliminado — cupo liberado')
                  }
                >
                  Confirmar eliminación
                </PremiumButton>
                <PremiumButton size="sm" variant="ghost" onClick={() => setShowDeleteTest(false)}>Cancelar</PremiumButton>
              </div>
            </div>
          )}

          {showDeleteFull && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 space-y-2">
              <p className="text-sm font-bold text-red-100">Eliminar usuario definitivamente</p>
              <p className="text-xs text-red-100/90">
                Esta acción elimina al usuario y todos sus datos relacionados. No se puede deshacer.
              </p>
              <textarea
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                placeholder="Motivo obligatorio"
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
              />
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="Escribí ELIMINAR"
              />
              <div className="flex gap-2">
                <PremiumButton
                  size="sm"
                  variant="danger"
                  disabled={busy || deleteConfirm !== 'ELIMINAR' || !deleteReason.trim()}
                  onClick={() =>
                    runAction(async () => {
                      await adminDeleteUserFull(u.id, deleteReason.trim(), 'ELIMINAR')
                      setShowDeleteFull(false)
                      setDeleteConfirm('')
                      setDeleteReason('')
                      onClose()
                    }, 'Usuario eliminado definitivamente — cupo liberado')
                  }
                >
                  Confirmar eliminación total
                </PremiumButton>
                <PremiumButton size="sm" variant="ghost" onClick={() => setShowDeleteFull(false)}>Cancelar</PremiumButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
