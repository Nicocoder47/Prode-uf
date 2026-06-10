/** Patrones alineados con public.is_test_user_email en Postgres. */
export function isTestUserEmail(email: string | null | undefined): boolean {
  const e = String(email ?? '').trim().toLowerCase()
  if (!e) return false
  if (/@loadtest\.prodemundial\.test$/.test(e)) return true
  if (/@prodemundial\.test$/.test(e)) return true
  if (/^(e2e-|score-audit-|score-bulk-|loadtest-)/.test(e)) return true
  if (/(^|[^a-z])(test|demo|fake|loadtest)([^a-z]|@|$)/.test(e)) return true
  return false
}
