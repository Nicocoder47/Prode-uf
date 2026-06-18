export const GLOBAL_ALERT_REFRESH_EVENT = 'prode:global-alert-refresh'
export const GLOBAL_ALERT_OPEN_EVENT = 'prode:global-alert-open'

export function notifyGlobalAlertRefresh() {
  window.dispatchEvent(new Event(GLOBAL_ALERT_REFRESH_EVENT))
}

export function requestOpenGlobalAlert() {
  window.dispatchEvent(new Event(GLOBAL_ALERT_OPEN_EVENT))
}
