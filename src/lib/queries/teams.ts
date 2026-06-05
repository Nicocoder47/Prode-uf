import type { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js'
import type { ApiResponse } from '../../types/api'
import { supabase } from '../supabase'

export interface TeamRow {
  id: string
  provider: string | null
  provider_team_id: string | null
  name: string
  code: string
  flag_url?: string
  group_label?: string
  confederation?: string
}

interface SyncLogRow {
  finished_at: string
}

function normalizeSupabaseError(error: PostgrestError | null): Error | null {
  return error ? new Error(error.message) : null
}

export async function getTeams(): Promise<ApiResponse<TeamRow[]>> {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('id,provider,provider_team_id,name,code,flag_url,group_label,provider')
      .order('name')

    if (error) {
      return { data: [], error: normalizeSupabaseError(error) }
    }

    const syncDataResult = await supabase
      .from('data_sync_logs')
      .select('finished_at')
      .eq('sync_type', 'teams')
      .order('finished_at', { ascending: false })
      .limit(1)
      .single() as PostgrestSingleResponse<SyncLogRow>
    const syncData = syncDataResult.data

    return {
      data: (data ?? []) as TeamRow[],
      lastSyncedAt: syncData?.finished_at ?? null,
      error: null,
    }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export async function getTeamById(id: string): Promise<ApiResponse<TeamRow | null>> {
  try {
    const { data, error } = await supabase.from('teams').select('*').eq('id', id).single()
    return { data: data ?? null, error: normalizeSupabaseError(error) }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
