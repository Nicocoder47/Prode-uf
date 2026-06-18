import { supabase } from '../lib/supabase'
import type { GlobalAppAlert, GlobalAppAlertInput } from '../types/globalAlert'

const FALLBACK_KEY = 'prode_global_alert_fallback'

function isRpcMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return error.code === 'PGRST202' || msg.includes('could not find the function') || msg.includes('schema cache')
}

function readFallback(): GlobalAppAlert {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY)
    if (!raw) {
      return {
        kicker: 'Aviso importante',
        title: '',
        message: '',
        is_active: false,
        updated_at: new Date(0).toISOString(),
      }
    }
    return JSON.parse(raw) as GlobalAppAlert
  } catch {
    return {
      kicker: 'Aviso importante',
      title: '',
      message: '',
      is_active: false,
      updated_at: new Date(0).toISOString(),
    }
  }
}

function writeFallback(alert: GlobalAppAlert) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(alert))
  } catch {
    /* ignore */
  }
}

function parseActiveAlert(data: unknown): GlobalAppAlert | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  if (row.is_active === false) return null
  const title = String(row.title ?? '').trim()
  const message = String(row.message ?? '').trim()
  if (!title && !message) return null
  return {
    kicker: String(row.kicker ?? 'Aviso importante'),
    title,
    message,
    is_active: true,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }
}

function parseAdminAlert(data: unknown): GlobalAppAlert {
  const row = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  return {
    kicker: String(row.kicker ?? 'Aviso importante'),
    title: String(row.title ?? ''),
    message: String(row.message ?? ''),
    is_active: Boolean(row.is_active),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  }
}

export async function fetchActiveGlobalAlert(): Promise<GlobalAppAlert | null> {
  const { data, error } = await supabase.rpc('get_active_global_alert')
  if (error) {
    if (isRpcMissing(error)) {
      const fallback = readFallback()
      return fallback.is_active ? parseActiveAlert(fallback) : null
    }
    throw error
  }
  if (data === null || data === undefined) return null
  return parseActiveAlert(data)
}

export async function fetchAdminGlobalAlert(): Promise<GlobalAppAlert> {
  const { data, error } = await supabase.rpc('admin_get_global_alert')
  if (error) {
    if (isRpcMissing(error)) return readFallback()
    throw error
  }
  return parseAdminAlert(data)
}

export async function adminUpsertGlobalAlert(input: GlobalAppAlertInput): Promise<GlobalAppAlert> {
  const { data, error } = await supabase.rpc('admin_upsert_global_alert', {
    p_kicker: input.kicker,
    p_title: input.title,
    p_message: input.message,
    p_is_active: input.isActive,
  })

  if (error) {
    if (isRpcMissing(error)) {
      const next: GlobalAppAlert = {
        kicker: input.kicker.trim() || 'Aviso importante',
        title: input.title.trim(),
        message: input.message.trim(),
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      }
      writeFallback(next)
      return next
    }
    throw error
  }

  return parseAdminAlert(data)
}
