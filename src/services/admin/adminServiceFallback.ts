import { supabase } from '../../lib/supabase'
import type {
  AdminActivityRow,
  AdminCard,
  AdminDashboard,
  AdminNotificationRow,
  AdminRankingRow,
  AdminUserRow,
  ReviewStatus,
} from '../../types/admin'

function maskDni(dni: string | null | undefined): string {
  const v = (dni ?? '').replace(/\D/g, '')
  if (!v) return '—'
  if (v.length <= 4) return '*'.repeat(v.length)
  return '*'.repeat(v.length - 4) + v.slice(-4)
}

function normalizePersonName(raw: string | null | undefined): string {
  return (raw ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function buildReferenceFullName(lastName: string | null, firstName: string | null): string {
  return normalizePersonName(`${lastName ?? ''}, ${firstName ?? ''}`)
}

function matchLabel(
  profileName: string,
  ref: { full_name?: string | null; last_name?: string | null; first_name?: string | null } | null,
): string {
  if (!ref) return 'No en padrón'
  const declared = normalizePersonName(profileName)
  const refFull = normalizePersonName(ref.full_name)
  const refBuilt = buildReferenceFullName(ref.last_name ?? null, ref.first_name ?? null)
  if (declared === refFull || declared === refBuilt) return 'Coincide'
  return 'Nombre distinto'
}

type MemberRef = {
  dni: string
  last_name: string | null
  first_name: string | null
  full_name: string | null
}

async function loadMemberReferenceMap(): Promise<Map<string, MemberRef>> {
  const { data } = await supabase.from('member_reference').select('dni, last_name, first_name, full_name')
  const map = new Map<string, MemberRef>()
  for (const row of data ?? []) {
    const key = (row.dni ?? '').replace(/\D/g, '')
    if (key) map.set(key, row)
  }
  return map
}

export async function fetchAdminDashboardFallback(): Promise<AdminDashboard> {
  const [
    { data: profiles, count: totalUsers },
    { count: totalPredictions },
    { data: matches },
    { data: syncRows },
    { data: leaderboard },
    { data: predUsers },
  ] = await Promise.all([
    supabase.from('profiles').select('id, is_active, created_at, full_name, legajo, email, review_status, review_reason, dni', { count: 'exact' }),
    supabase.from('predictions').select('*', { count: 'exact', head: true }),
    supabase.from('matches').select('status'),
    supabase.from('data_sync_logs').select('*').order('started_at', { ascending: false }).limit(1),
    supabase
      .from('leaderboard')
      .select('rank, points, wins, draws, losses, user_id, profiles(full_name, legajo, email)')
      .eq('period', 'global')
      .order('rank', { ascending: true })
      .limit(10),
    supabase.from('predictions').select('user_id'),
  ])

  const rows = profiles ?? []
  const activeUsers = rows.filter(p => p.is_active !== false).length
  const blockedUsers = rows.filter(p => p.is_active === false).length
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const refMap = await loadMemberReferenceMap()

  const top10: AdminRankingRow[] = (leaderboard ?? []).map((row: Record<string, unknown>) => {
    const prof = row.profiles as { full_name?: string; legajo?: string; email?: string } | null
    return {
      rank: row.rank as number,
      points: row.points as number,
      wins: row.wins as number,
      draws: row.draws as number,
      losses: row.losses as number,
      user_id: row.user_id as string,
      full_name: prof?.full_name ?? '—',
      legajo: prof?.legajo ?? null,
      email: prof?.email ?? '',
    }
  })

  const reviewRequired = rows.filter(p => p.review_status === 'review_required')
  const usersWithPreds = new Set((predUsers ?? []).map(p => p.user_id))

  return {
    total_users: totalUsers ?? rows.length,
    active_users: activeUsers,
    blocked_users: blockedUsers,
    deleted_users: 0,
    users_verified: rows.filter(p => p.review_status === 'verified').length,
    users_review_required: reviewRequired.length,
    users_manually_approved: rows.filter(p => p.review_status === 'manually_approved').length,
    users_rejected: rows.filter(p => p.review_status === 'rejected').length,
    total_predictions: totalPredictions ?? 0,
    users_without_predictions: rows.filter(p => !usersWithPreds.has(p.id)).length,
    today_logins: 0,
    today_registrations: rows.filter(p => p.created_at && new Date(p.created_at) >= today).length,
    scheduled_matches: matches?.filter(m => m.status === 'scheduled').length ?? 0,
    live_matches: matches?.filter(m => m.status === 'live').length ?? 0,
    finished_matches: matches?.filter(m => m.status === 'finished').length ?? 0,
    last_sync: syncRows?.[0] ?? null,
    top_10_ranking: top10,
    latest_activity_logs: [],
    admin_cards: [],
    latest_registrations: [...rows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        full_name: p.full_name,
        legajo: p.legajo,
        email: p.email,
        created_at: p.created_at,
      })),
    latest_logins: [...rows]
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        full_name: p.full_name,
        legajo: p.legajo,
        email: p.email,
        last_login_at: null,
      })),
    review_required_users: reviewRequired
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50)
      .map(p => {
        const ref = refMap.get((p.dni ?? '').replace(/\D/g, ''))
        return {
          id: p.id,
          legajo: p.legajo,
          full_name: p.full_name,
          dni: maskDni(p.dni),
          email: p.email,
          created_at: p.created_at,
          review_reason: p.review_reason,
          reference_full_name: ref?.full_name ?? null,
        }
      }),
  }
}

export async function fetchAdminUsersFallback(): Promise<AdminUserRow[]> {
  const [{ data: profiles }, { data: predictions }, { data: leaderboard }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('predictions').select('user_id, status, points'),
    supabase.from('leaderboard').select('user_id, points').eq('period', 'global'),
  ])

  const refMap = await loadMemberReferenceMap()

  const predCount = new Map<string, number>()
  const exactCount = new Map<string, number>()
  const hitCount = new Map<string, number>()
  for (const p of predictions ?? []) {
    predCount.set(p.user_id, (predCount.get(p.user_id) ?? 0) + 1)
    if (p.status === 'scored' && (p.points ?? 0) >= 5) {
      exactCount.set(p.user_id, (exactCount.get(p.user_id) ?? 0) + 1)
    }
    if (p.status === 'scored' && (p.points ?? 0) > 0) {
      hitCount.set(p.user_id, (hitCount.get(p.user_id) ?? 0) + 1)
    }
  }
  const pointsMap = new Map((leaderboard ?? []).map(l => [l.user_id, l.points]))

  return (profiles ?? [])
    .map(p => {
      const ref = refMap.get((p.dni ?? '').replace(/\D/g, '')) ?? null
      return {
        id: p.id,
        legajo: p.legajo ?? null,
        full_name: p.full_name,
        dni_masked: maskDni(p.dni),
        email: p.email,
        role: p.role,
        is_active: p.is_active !== false,
        deleted_at: p.deleted_at ?? null,
        deleted_reason: p.deleted_reason ?? null,
        created_at: p.created_at,
        last_login_at: p.last_login_at ?? null,
        predictions_count: predCount.get(p.id) ?? 0,
        exact_predictions: exactCount.get(p.id) ?? 0,
        hit_predictions: hitCount.get(p.id) ?? 0,
        total_points: pointsMap.get(p.id) ?? 0,
        review_status: (p.review_status as ReviewStatus) ?? 'pending',
        review_reason: p.review_reason ?? null,
        reviewed_at: p.reviewed_at ?? null,
        reference_last_name: ref?.last_name ?? null,
        reference_first_name: ref?.first_name ?? null,
        reference_full_name: ref?.full_name ?? null,
        match_label: matchLabel(p.full_name, ref),
      }
    })
    .sort((a, b) => {
      if (a.review_status === 'review_required' && b.review_status !== 'review_required') return -1
      if (b.review_status === 'review_required' && a.review_status !== 'review_required') return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
}

export async function adminSetUserActiveFallback(userId: string, active: boolean) {
  const payload: Record<string, unknown> = { is_active: active, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
  if (error) throw error
}

export async function adminSetUserRoleFallback(userId: string, role: 'admin' | 'member') {
  const { error } = await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', userId)
  if (error) throw error
}

export async function adminSoftDeleteUserFallback(userId: string, reason: string) {
  const payload: Record<string, unknown> = {
    is_active: false,
    updated_at: new Date().toISOString(),
  }
  const { error: probe } = await supabase.from('profiles').select('deleted_at').limit(1)
  if (!probe) {
    payload.deleted_at = new Date().toISOString()
    payload.deleted_reason = reason || 'Eliminado por admin'
  }
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
  if (error) throw error
}

export async function adminApproveUserFallback(userId: string, reason: string) {
  const { data: session } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('profiles')
    .update({
      review_status: 'manually_approved',
      review_reason: reason || 'Aprobado manualmente por admin',
      reviewed_by: session.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
}

export async function adminRejectUserFallback(userId: string, reason: string) {
  const { data: session } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('profiles')
    .update({
      review_status: 'rejected',
      review_reason: reason || 'Rechazado por admin',
      reviewed_by: session.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
}

export function isRpcMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = error.message?.toLowerCase() ?? ''
  return (
    error.code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  )
}

export async function fetchAdminActivityFallback(): Promise<AdminActivityRow[]> {
  return []
}

export async function fetchAdminNotificationsFallback(): Promise<AdminNotificationRow[]> {
  return []
}

export async function fetchAdminCardsFallback(): Promise<AdminCard[]> {
  return []
}
