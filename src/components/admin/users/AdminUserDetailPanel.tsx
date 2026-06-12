import { ChevronDown, ChevronUp, FileText, Settings2, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { AdminConfirmModal } from '../AdminConfirmModal'
import { AdminUserInfoSections } from '../AdminUserInfoSections'
import { PremiumButton } from '../../ui/PremiumButton'
import { useAppToast } from '../../ui/ToastProvider'
import { useAdminUserDetail, useInvalidateAdmin } from '../../../hooks/useAdminQueries'
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
} from '../../../services/admin/adminService'
import type { AdminUserRow } from '../../../types/admin'
import { isTestUserEmail } from '../../../utils/adminTestUser'
import {
  getAccountStateLabel,
  getActivityStateLabel,
  verificationResultLabel,
} from '../../../utils/adminUserVisualStatus'

type Props = {
  user: AdminUserRow
  onClose: () => void
  onChanged: () => void
  variant?: 'panel' | 'sheet'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-user-detail-section">
      <h3 className="admin-user-detail-section__title">{title}</h3>
      <dl className="admin-user-detail-section__grid">{children}</dl>
    </section>
  )
}

function DetailField({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={`admin-user-detail-field${wide ? ' admin-user-detail-field--wide' : ''}`}>
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  )
}

export function AdminUserDetailPanel({ user, onClose, onChanged, variant = 'panel' }: Props) {
  const { data: detail, isLoading, refetch } = useAdminUserDetail(user.id)
  const { invalidateUserDetail, invalidateUsers, invalidateBetaOverview, invalidateDashboard } = useInvalidateAdmin()
  const { showToast } = useAppToast()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFullInfo, setShowFullInfo] = useState(false)
  const [showMoreActions, setShowMoreActions] = useState(false)
  const [actionReason, setActionReason] = useState('')
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyMessage, setNotifyMessage] = useState('')

  const [showDeactivate, setShowDeactivate] = useState(false)
  const [deactivateConfirm, setDeactivateConfirm] = useState('')
  const [showPromote, setShowPromote] = useState(false)
  const [promoteConfirm, setPromoteConfirm] = useState('')
  const [showDeleteTest, setShowDeleteTest] = useState(false)
  const [showDeleteFull, setShowDeleteFull] = useState(false)
  const [showResetPred, setShowResetPred] = useState(false)
  const [showResetScore, setShowResetScore] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteReason, setDeleteReason] = useState('')

  const u = detail?.user ?? user
  const padron = detail?.padron ?? null
  const lastActivity = detail?.activity?.[0] ?? null
  const isTest = u.is_test_user ?? isTestUserEmail(u.email)
  const accountLabel = getAccountStateLabel(u)

  async function runAction(action: () => Promise<void>, message: string, closeAfter = false) {
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
      showToast(message)
      if (closeAfter) onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  const padronName = padron?.full_name
    ?? ([padron?.last_name, padron?.first_name].filter(Boolean).join(' ') || '—')

  function handleDirectDelete() {
    if (isTest) {
      void runAction(() => adminDeleteTestUser(u.id), 'Usuario eliminado de la base de datos', true)
      return
    }
    void runAction(
      () => adminDeleteUserFull(u.id, 'Eliminación directa desde panel admin', 'ELIMINAR'),
      'Usuario eliminado de la base de datos',
      true,
    )
  }

  const legajoInPadron = !padron
    ? 'No'
    : u.match_label?.toLowerCase().includes('legajo')
      ? (u.match_label.toLowerCase().includes('coincide') ? 'Sí' : 'No')
      : 'No disponible en padrón'

  return (
    <div className={`admin-user-detail-panel admin-user-detail-panel--${variant}`}>
      <header className="admin-user-detail-panel__header">
        <div className="min-w-0 flex-1">
          <p className="admin-user-detail-panel__kicker">Detalle de usuario</p>
          <h2 className="admin-user-detail-panel__name">{u.full_name}</h2>
          <p className="admin-user-detail-panel__email">{u.email}</p>
        </div>
        <PremiumButton size="sm" variant="ghost" onClick={onClose}>Cerrar</PremiumButton>
      </header>

      <div className="admin-user-detail-panel__toolbar">
        <button
          type="button"
          className={`admin-user-detail-panel__toggle${showFullInfo ? ' is-active' : ''}`}
          onClick={() => setShowFullInfo(v => !v)}
        >
          <FileText className="h-4 w-4" />
          {showFullInfo ? 'Ocultar ficha completa' : 'Ver ficha completa'}
          {showFullInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {u.role !== 'admin' && !u.deleted_at && (
          <button
            type="button"
            className={`admin-user-detail-panel__toggle admin-user-detail-panel__toggle--muted${showMoreActions ? ' is-active' : ''}`}
            onClick={() => setShowMoreActions(v => !v)}
          >
            <Settings2 className="h-4 w-4" />
            {showMoreActions ? 'Ocultar más acciones' : 'Más acciones'}
            {showMoreActions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
        {u.role !== 'admin' && !u.deleted_at && (
          <button
            type="button"
            className="admin-user-detail-panel__toggle admin-user-detail-panel__toggle--danger"
            disabled={busy}
            onClick={handleDirectDelete}
          >
            <Trash2 className="h-4 w-4" />
            Eliminación directa
          </button>
        )}
      </div>

      <div className="admin-user-detail-panel__body">
        {error && <p className="admin-user-detail-panel__error">{error}</p>}
        {isLoading && <p className="text-sm text-white/50">Cargando datos…</p>}

        <DetailSection title="Datos declarados">
          <DetailField label="Nombre completo" value={u.full_name} wide />
          <DetailField label="Email" value={u.email} wide />
          <DetailField label="DNI" value={u.dni_masked} />
          <DetailField label="Legajo" value={u.legajo ?? '—'} />
          <DetailField label="Fecha de registro" value={formatDate(u.created_at)} />
          <DetailField label="Último login" value={formatDate(u.last_login_at)} />
          <DetailField label="Rol" value={u.role} />
          <DetailField label="Estado" value={accountLabel} />
        </DetailSection>

        <DetailSection title="Validación contra padrón">
          <DetailField label="Resultado" value={verificationResultLabel(u.review_status)} wide />
          <DetailField label="DNI en padrón" value={padron?.dni ? 'Sí' : 'No'} />
          <DetailField label="Legajo en padrón" value={legajoInPadron} />
          <DetailField label="Nombre en padrón" value={padronName} wide />
          <DetailField label="Observación" value={u.review_reason ?? u.match_label ?? '—'} wide />
        </DetailSection>

        <DetailSection title="Actividad">
          <DetailField label="Puntos" value={u.total_points} />
          <DetailField label="Predicciones" value={u.predictions_count} />
          <DetailField label="Exactas" value={u.exact_predictions ?? 0} />
          <DetailField label="Aciertos" value={u.hit_predictions ?? 0} />
          <DetailField
            label="Última actividad"
            wide
            value={lastActivity ? `${lastActivity.title} · ${formatDate(lastActivity.created_at)}` : formatDate(u.last_login_at)}
          />
          <DetailField label="Estado de actividad" value={getActivityStateLabel(u)} />
        </DetailSection>

        {showFullInfo && (
          <div className="admin-user-detail-panel__expand">
            <p className="admin-user-detail-panel__expand-title">Ficha completa del usuario</p>
            <p className="admin-user-detail-panel__expand-hint">
              Incluye ID interno, DNI completo (si está disponible), seguridad, historial y predicciones.
            </p>
            <AdminUserInfoSections
              user={u}
              padron={padron}
              formatDate={formatDate}
              accountLabel={accountLabel}
              isTest={isTest}
            />

            <section className="admin-user-detail-section">
              <h3 className="admin-user-detail-section__title">Predicciones</h3>
              {(detail?.predictions ?? []).length ? (
                <div className="admin-user-detail-predictions">
                  {detail!.predictions.map(p => (
                    <div key={p.id} className="admin-user-detail-pred-row">
                      <span className="admin-user-detail-pred-row__match">{p.home_team ?? '?'} vs {p.away_team ?? '?'}</span>
                      <span className="admin-user-detail-pred-row__score">
                        {p.predicted_score_home ?? '—'} - {p.predicted_score_away ?? '—'}
                        {p.result_home != null && ` · Res: ${p.result_home}-${p.result_away}`}
                      </span>
                      <span className="admin-user-detail-pred-row__pts">{p.points} pts</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/45">Sin predicciones registradas.</p>
              )}
            </section>

            <section className="admin-user-detail-section">
              <h3 className="admin-user-detail-section__title">Movimientos y notificaciones</h3>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Movimientos</p>
                {(detail?.activity ?? []).length ? detail!.activity.slice(0, 8).map(a => (
                  <div key={a.id} className="admin-user-detail-audit-row">
                    <span>{a.title}</span>
                    <span className="text-white/45">{formatDate(a.created_at)}</span>
                  </div>
                )) : <p className="text-sm text-white/45">Sin movimientos.</p>}
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Notificaciones</p>
                {(detail?.notifications ?? []).length ? detail!.notifications.slice(0, 5).map(n => (
                  <div key={n.id} className="admin-user-detail-audit-row">
                    <span>{n.title}</span>
                    <span className="text-white/45">{n.is_read ? 'Leída' : 'No leída'}</span>
                  </div>
                )) : <p className="text-sm text-white/45">Sin notificaciones.</p>}
              </div>
            </section>
          </div>
        )}

        {showMoreActions && u.role !== 'admin' && !u.deleted_at && (
          <div className="admin-user-detail-panel__expand admin-user-detail-panel__expand--danger">
            <p className="admin-user-detail-panel__expand-title">Más acciones de administración</p>
            <label className="admin-user-detail-panel__reason-label">Motivo / notas (opcional)</label>
            <input
              className="admin-user-detail-panel__reason-input"
              placeholder="Motivo de la acción"
              value={actionReason}
              onChange={e => setActionReason(e.target.value)}
            />
            <div className="admin-user-detail-panel__more-grid">
              <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={() => runAction(() => adminForcePasswordChange(u.id), 'Cambio de contraseña forzado')}>
                Forzar cambio clave
              </PremiumButton>
              <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={() => setShowDeactivate(true)}>
                Desactivar (soft)
              </PremiumButton>
              <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={() => setShowPromote(true)}>
                Promover admin
              </PremiumButton>
              <PremiumButton size="sm" variant="danger" disabled={busy} onClick={() => setShowResetPred(true)}>
                Reset predicciones
              </PremiumButton>
              <PremiumButton size="sm" variant="danger" disabled={busy} onClick={() => setShowResetScore(true)}>
                Reset puntaje
              </PremiumButton>
              {isTest && (
                <PremiumButton size="sm" variant="danger" disabled={busy} onClick={() => setShowDeleteTest(true)}>
                  Eliminar test
                </PremiumButton>
              )}
              <PremiumButton size="sm" variant="danger" disabled={busy} onClick={() => setShowDeleteFull(true)}>
                Eliminar definitivo
              </PremiumButton>
            </div>
            <div className="admin-user-detail-panel__notify">
              <p className="admin-user-detail-panel__expand-title">Notificación personal</p>
              <input className="admin-user-detail-panel__reason-input" placeholder="Título" value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} />
              <textarea rows={2} className="admin-user-detail-panel__reason-input" placeholder="Mensaje" value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} />
              <PremiumButton
                size="sm"
                disabled={busy || !notifyTitle.trim() || !notifyMessage.trim()}
                onClick={() => runAction(() => adminCreateNotification({ title: notifyTitle, message: notifyMessage, targetType: 'user', targetUserId: u.id }), 'Notificación enviada')}
              >
                Enviar notificación
              </PremiumButton>
            </div>
          </div>
        )}
      </div>

      {u.role !== 'admin' && !u.deleted_at && (
        <footer className="admin-user-detail-panel__actions">
          <PremiumButton size="sm" disabled={busy} onClick={() => runAction(() => adminApproveUser(u.id, actionReason || 'Aprobado por admin'), 'Usuario aprobado')}>
            Aprobar usuario
          </PremiumButton>
          <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={() => runAction(() => adminRejectUser(u.id, actionReason || 'Marcado para revisión por admin'), 'Usuario marcado para revisión')}>
            Marcar para revisar
          </PremiumButton>
          {u.is_blocked || !u.is_active ? (
            <PremiumButton size="sm" variant="ghost" disabled={busy} onClick={() => runAction(() => adminUnblockUser(u.id), 'Usuario desbloqueado')}>
              Desbloquear usuario
            </PremiumButton>
          ) : (
            <PremiumButton size="sm" variant="danger" disabled={busy} onClick={() => runAction(() => adminBlockUser(u.id, actionReason || 'Bloqueado desde panel admin'), 'Usuario bloqueado')}>
              Bloquear usuario
            </PremiumButton>
          )}
          <PremiumButton size="sm" variant="ghost" onClick={onClose}>Cerrar</PremiumButton>
        </footer>
      )}

      <AdminConfirmModal
        open={showDeactivate}
        title="Desactivar usuario (soft delete)"
        description={<p>Se desactivará <strong>{u.email}</strong>. El historial se conserva para auditoría.</p>}
        confirmLabel="Desactivar"
        confirmPhrase="DESACTIVAR"
        confirmValue={deactivateConfirm}
        onConfirmValueChange={setDeactivateConfirm}
        reason={actionReason}
        onReasonChange={setActionReason}
        reasonRequired
        reversible
        busy={busy}
        onCancel={() => { setShowDeactivate(false); setDeactivateConfirm('') }}
        onConfirm={() => runAction(async () => { await adminSoftDeleteUser(u.id, actionReason); setShowDeactivate(false); setDeactivateConfirm('') }, 'Usuario desactivado')}
      />

      <AdminConfirmModal
        open={showPromote}
        title="Promover a administrador"
        description={<p><strong>{u.full_name}</strong> tendrá acceso completo al panel admin.</p>}
        confirmLabel="Promover"
        confirmPhrase="PROMOVER ADMIN"
        confirmValue={promoteConfirm}
        onConfirmValueChange={setPromoteConfirm}
        reversible
        busy={busy}
        onCancel={() => { setShowPromote(false); setPromoteConfirm('') }}
        onConfirm={() => runAction(async () => { await adminSetUserRole(u.id, 'admin'); setShowPromote(false); setPromoteConfirm('') }, 'Promovido a admin')}
      />

      <AdminConfirmModal
        open={showResetPred}
        title="Resetear predicciones"
        description={<p>Se eliminarán todas las predicciones de <strong>{u.full_name}</strong>.</p>}
        confirmLabel="Reset predicciones"
        confirmPhrase="RESET PRED"
        confirmValue={deleteConfirm}
        onConfirmValueChange={setDeleteConfirm}
        reversible={false}
        busy={busy}
        onCancel={() => { setShowResetPred(false); setDeleteConfirm('') }}
        onConfirm={() => runAction(async () => { await adminResetUserPredictions(u.id); setShowResetPred(false); setDeleteConfirm('') }, 'Predicciones reseteadas')}
      />

      <AdminConfirmModal
        open={showResetScore}
        title="Resetear puntaje"
        description={<p>El puntaje de <strong>{u.full_name}</strong> volverá a 0.</p>}
        confirmLabel="Reset puntaje"
        confirmPhrase="RESET PUNTOS"
        confirmValue={deleteConfirm}
        onConfirmValueChange={setDeleteConfirm}
        reversible={false}
        busy={busy}
        onCancel={() => { setShowResetScore(false); setDeleteConfirm('') }}
        onConfirm={() => runAction(async () => { await adminResetUserScore(u.id); setShowResetScore(false); setDeleteConfirm('') }, 'Puntaje reseteado')}
      />

      <AdminConfirmModal
        open={showDeleteTest}
        title="Eliminar usuario de prueba"
        description={<p>Se borrará <strong>{u.email}</strong> y todos sus datos. El cupo quedará liberado.</p>}
        confirmLabel="Eliminar test"
        confirmPhrase="ELIMINAR_TEST"
        confirmValue={deleteConfirm}
        onConfirmValueChange={setDeleteConfirm}
        reversible={false}
        busy={busy}
        onCancel={() => { setShowDeleteTest(false); setDeleteConfirm('') }}
        onConfirm={() => runAction(async () => { await adminDeleteTestUser(u.id); setShowDeleteTest(false); setDeleteConfirm('') }, 'Usuario de prueba eliminado', true)}
      />

      <AdminConfirmModal
        open={showDeleteFull}
        title="Eliminar usuario definitivamente"
        description={<p>Se eliminará <strong>{u.email}</strong> y todos los datos relacionados.</p>}
        confirmLabel="Eliminar definitivo"
        confirmPhrase="ELIMINAR"
        confirmValue={deleteConfirm}
        onConfirmValueChange={setDeleteConfirm}
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        reasonRequired
        reversible={false}
        busy={busy}
        onCancel={() => { setShowDeleteFull(false); setDeleteConfirm(''); setDeleteReason('') }}
        onConfirm={() => runAction(async () => { await adminDeleteUserFull(u.id, deleteReason.trim(), 'ELIMINAR'); setShowDeleteFull(false); setDeleteConfirm(''); setDeleteReason('') }, 'Usuario eliminado definitivamente', true)}
      />
    </div>
  )
}
