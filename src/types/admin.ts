export type ActivityLogType =
  | 'user_registered'
  | 'user_login'
  | 'prediction_created'
  | 'prediction_updated'
  | 'user_blocked'
  | 'user_unblocked'
  | 'user_deleted'
  | 'user_manually_approved'
  | 'user_rejected'
  | 'notification_created'
  | 'notification_read'
  | 'admin_card_updated'
  | 'admin_role_changed'
  | 'score_calculated'
  | 'sync_completed'
  | 'sync_failed'

export type ReviewStatus = 'pending' | 'verified' | 'review_required' | 'manually_approved' | 'rejected'

export interface AdminDashboard {
  total_users: number
  active_users: number
  blocked_users: number
  deleted_users: number
  users_verified?: number
  users_review_required?: number
  users_manually_approved?: number
  users_rejected?: number
  review_required_users?: ReviewRequiredUser[]
  total_predictions: number
  users_without_predictions?: number
  today_logins: number
  today_registrations: number
  scheduled_matches: number
  live_matches: number
  finished_matches: number
  last_sync: {
    id: string
    provider: string
    sync_type: string
    status: string
    records_upserted: number
    error_message: string | null
    started_at: string
    finished_at: string | null
  } | null
  top_10_ranking: AdminRankingRow[]
  upcoming_matches?: UpcomingMatchRow[]
  latest_activity_logs: AdminActivityRow[]
  admin_cards: AdminCard[]
  latest_registrations: AdminUserBrief[]
  latest_logins: AdminUserBrief[]
}

export interface BetaCapacitySnapshot {
  id: string
  created_at: string
  total_users: number
  active_users_7d: number
  total_predictions: number
  estimated_concurrent_peak: number
  capacity_status: string
  migration_recommendation: string
  notes: string | null
}

export interface DeviceHealthSummary {
  reports_24h: number
  errors_24h: number
  error_rate: number
  errors_by_device: Record<string, number>
  errors_by_browser: Record<string, number>
  slow_routes: { route: string; avg_ms: number }[]
  top_error_routes: { route: string; count: number }[]
  mobile_error_share_pct: number
}

export interface AdminBetaCapacity {
  registered_users: number
  new_users_today: number
  new_users_7d: number
  new_users_30d: number
  active_users_24h: number
  active_users_7d: number
  total_predictions: number
  predictions_24h: number
  predictions_7d: number
  users_with_predictions: number
  users_played_pct: number
  estimated_concurrent_users: number
  capacity_percent: number
  status: 'green' | 'yellow' | 'red' | 'exceeded'
  recommendation: string
  technical_action: 'seguir_gratis' | 'monitorear' | 'cerrar_invitaciones' | 'migrar'
  device_health: DeviceHealthSummary
  migration_needed: boolean
  reasons: string[]
  recent_sync_errors_24h: number
  auth_errors_429_24h?: number
  read_p95_ms?: number | null
  save_p95_ms?: number | null
  last_sync: {
    id?: string
    status?: string
    sync_type?: string
    started_at?: string
    finished_at?: string | null
    error_message?: string | null
  } | null
  latest_snapshots: BetaCapacitySnapshot[]
  registration_open?: boolean
  users_must_change_password?: number
  users_blocked?: number
  users_deactivated?: number
  /** Compat legacy */
  total_users?: number
  active_users_today?: number
  predictions_today?: number
}

export interface AdminRankingRow {
  rank: number
  points: number
  wins: number
  draws: number
  losses: number
  user_id: string
  full_name: string
  legajo: string | null
  email: string
}

export interface AdminActivityRow {
  id: string
  type: ActivityLogType
  title: string
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
  user_id: string | null
  full_name: string | null
  legajo: string | null
  user_name?: string | null
  user_legajo?: string | null
  actor_name?: string | null
}

export interface AdminUserRow {
  id: string
  legajo: string | null
  full_name: string
  dni?: string | null
  dni_masked: string
  email: string
  role: string
  is_active: boolean
  deleted_at: string | null
  deleted_reason: string | null
  created_at: string
  last_login_at: string | null
  must_change_password?: boolean
  password_changed_at?: string | null
  is_blocked?: boolean
  block_reason?: string | null
  active_last_7d?: boolean
  is_test_user?: boolean
  never_logged_in?: boolean
  registered_today?: boolean
  predictions_count: number
  exact_predictions?: number
  hit_predictions?: number
  total_points: number
  review_status?: ReviewStatus
  review_reason?: string | null
  reviewed_at?: string | null
  reference_last_name?: string | null
  reference_first_name?: string | null
  reference_full_name?: string | null
  match_label?: string
}

export interface AdminBetaOverview {
  max_users: number
  registered_users: number
  available_slots: number
  capacity_percent: number
  new_users_today: number
  users_without_predictions: number
  users_with_predictions: number
  users_blocked: number
  test_users_detected: number
  registration_open: boolean
  last_score_calculated_at: string | null
  last_scored_match: {
    id: string
    score_home: number | null
    score_away: number | null
    scored_at: string | null
    kick_off: string | null
  } | null
}

export interface AdminDeleteUserResult {
  success: boolean
  deleted_user_id: string
  deleted_email: string
  affected_tables: Record<string, number>
  freed_slot: boolean
}

export interface AdminTestUsersPreview {
  count: number
  users: { id: string; email: string; full_name: string }[]
}

export interface ReviewRequiredUser {
  id: string
  legajo: string | null
  full_name: string
  dni: string | null
  email: string
  created_at: string
  review_reason: string | null
  reference_full_name: string | null
}

export interface AdminUserBrief {
  id: string
  full_name: string
  legajo: string | null
  email: string
  created_at?: string
  last_login_at?: string | null
}

export interface AdminCard {
  id: string
  key: string
  title: string
  value: string | null
  subtitle: string | null
  description: string | null
  icon: string | null
  status: 'neutral' | 'success' | 'warning' | 'danger'
  order_index: number
  is_active: boolean
}

export interface AppNotification {
  id: string
  title: string
  message: string
  target_type: 'all' | 'user' | 'role'
  created_at: string
  expires_at: string | null
  is_read: boolean
}

export interface UpcomingMatchRow {
  id: string
  kick_off: string
  status: string
  home_team_id: string | null
  away_team_id: string | null
  phase: string | null
  group_label: string | null
}

export interface AdminUserPredictionRow {
  id: string
  match_id: string
  predicted_score_home: number | null
  predicted_score_away: number | null
  points: number
  status: string
  created_at: string
  updated_at: string
  kick_off: string
  match_status: string
  result_home: number | null
  result_away: number | null
  home_team: string | null
  away_team: string | null
}

export interface AdminUserDetailPadron {
  dni: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  source: string | null
}

export interface AdminUserDetail {
  user: AdminUserRow
  padron: AdminUserDetailPadron | null
  predictions: AdminUserPredictionRow[]
  activity: AdminActivityRow[]
  notifications: Array<{
    id: string
    title: string
    message: string
    created_at: string
    expires_at: string | null
    is_read: boolean
  }>
}

export interface AdminNotificationRow {
  id: string
  title: string
  message: string
  target_type: string
  target_user_id: string | null
  target_role: string | null
  created_by: string | null
  is_active: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
  creator_name: string | null
  target_user_name: string | null
  read_count: number
}
