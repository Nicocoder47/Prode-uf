import { supabase } from '../lib/supabase'
import type { DeviceType } from '../utils/deviceInfo'

export type DeviceEventType = 'page_view' | 'error' | 'performance'

export type DeviceReportPayload = {
  user_id?: string | null
  session_id: string
  device_type: DeviceType
  browser: string
  os: string
  viewport_width: number
  viewport_height: number
  user_agent: string
  route: string
  event_type: DeviceEventType
  error_message?: string | null
  performance_ms?: number | null
}

function sanitizeReport(payload: DeviceReportPayload): DeviceReportPayload {
  const stripSensitive = (s: string) =>
    s
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
      .replace(/\b\d{7,8}\b/g, '[dni]')
      .slice(0, 500)

  return {
    ...payload,
    user_agent: payload.user_agent.slice(0, 300),
    error_message: payload.error_message ? stripSensitive(payload.error_message) : null,
  }
}

export async function insertDeviceReport(payload: DeviceReportPayload): Promise<void> {
  const { error } = await supabase.from('device_reports').insert(sanitizeReport(payload))
  if (error) throw error
}
