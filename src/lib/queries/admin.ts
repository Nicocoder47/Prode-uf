import type { PostgrestError } from '@supabase/supabase-js'
import type { ApiResponse } from '../../types/api'
import { supabase } from '../supabase'

interface SyncLogRow {
  finished_at: string
  records_upserted?: number
  records_skipped?: number
  status: string
}

function normalizeSupabaseError(error: PostgrestError | null): Error | null {
  return error ? new Error(error.message) : null
}

export async function getLastSync(syncType: string): Promise<ApiResponse<SyncLogRow | null>> {
  try {
    const { data, error } = await supabase
      .from('data_sync_logs')
      .select('finished_at,records_upserted,records_skipped,status')
      .eq('sync_type', syncType)
      .order('finished_at', { ascending: false })
      .limit(1)
      .single()

    return { data: data ?? null, error: normalizeSupabaseError(error) }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export async function triggerSync(type: string): Promise<ApiResponse<null>> {
  try {
    const { error } = await supabase.from('data_sync_logs').insert([{ provider: 'manual', sync_type: type, status: 'requested' }])
    return { data: null, error: normalizeSupabaseError(error) }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
