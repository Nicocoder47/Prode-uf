import type { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js'
import type { ApiResponse } from '../../types/api'
import { supabase } from '../supabase'

export interface PlayerRow {
  id: string
  team_id: string
  name: string
  position?: string
  date_of_birth?: string
  nationality?: string
  club?: string
  photo_url?: string
}

interface SyncLogRow {
  finished_at: string
}

function normalizeSupabaseError(error: PostgrestError | null): Error | null {
  return error ? new Error(error.message) : null
}

export async function getPlayersByTeam(teamId: string): Promise<ApiResponse<PlayerRow[]>> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id,team_id,name,position,date_of_birth,nationality,club,photo_url')
      .eq('team_id', teamId)
      .order('name')

    if (error) {
      return { data: [], error: normalizeSupabaseError(error) }
    }

    const syncDataResult = await supabase
      .from('data_sync_logs')
      .select('finished_at')
      .eq('sync_type', 'rosters')
      .order('finished_at', { ascending: false })
      .limit(1)
      .single() as PostgrestSingleResponse<SyncLogRow>
    const syncData = syncDataResult.data

    return {
      data: (data ?? []) as PlayerRow[],
      lastSyncedAt: syncData?.finished_at ?? null,
      error: null,
    }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export async function getPlayerById(id: string): Promise<ApiResponse<PlayerRow | null>> {
  try {
    const { data, error } = await supabase.from('players').select('*').eq('id', id).single()
    return { data: data ?? null, error: normalizeSupabaseError(error) }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}

export async function getAllPlayers(): Promise<ApiResponse<PlayerRow[]>> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('id,team_id,name,position,date_of_birth,nationality,club,photo_url')
      .order('name')

    if (error) {
      return { data: [], error: normalizeSupabaseError(error) }
    }

    const syncDataResult = await supabase
      .from('data_sync_logs')
      .select('finished_at')
      .eq('sync_type', 'rosters')
      .order('finished_at', { ascending: false })
      .limit(1)
      .single() as PostgrestSingleResponse<SyncLogRow>
    const syncData = syncDataResult.data

    return {
      data: (data ?? []) as PlayerRow[],
      lastSyncedAt: syncData?.finished_at ?? null,
      error: null,
    }
  } catch (err) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) }
  }
}
