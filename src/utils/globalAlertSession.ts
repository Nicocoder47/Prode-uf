import type { GlobalAppAlert } from '../types/globalAlert'

const DISMISS_KEY = 'prode_global_alert_dismissed'

export function globalAlertVersion(alert: GlobalAppAlert): string {
  return `${alert.updated_at}|${alert.kicker}|${alert.title}|${alert.message}|${alert.is_active}`
}

export function isGlobalAlertDismissed(alert: GlobalAppAlert): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === globalAlertVersion(alert)
  } catch {
    return false
  }
}

export function dismissGlobalAlert(alert: GlobalAppAlert) {
  try {
    sessionStorage.setItem(DISMISS_KEY, globalAlertVersion(alert))
  } catch {
    /* ignore */
  }
}

export function clearGlobalAlertDismiss() {
  try {
    sessionStorage.removeItem(DISMISS_KEY)
  } catch {
    /* ignore */
  }
}
