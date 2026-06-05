import type { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js'
import type { ApiResponse } from '../../types/api'
import { supabase } from '../supabase'

export interface MatchRow {
  id: string
  provider: string | null
  provider_match_id: string | null
  home_team_id: string | null
  away_team_id: string | null
  kick_off: string | null
  stadium: string | null
  city: string | null
  status: string
  score_home?: number | null
  score_away?: number | null
  phase?: string
  group_label?: string
}

interface SyncLogRow {
  finished_at: string
}

function normalizeSupabaseError(error: PostgrestError | null): Error | null {
  return error ? new Error(error.message) : null
}

export async function getMatches(opts?: { teamId?: string; group?: string; from?: string; to?: string }): Promise<ApiResponse<MatchRow[]>> {
  try {
    let qb = supabase
      .from('matches')
      .select('id,provider,provider_match_id,home_team_id,away_team_id,kick_off,stadium,city,status,score_home,score_away,phase,group_label')

    if (opts?.teamId) {
      qb = qb.or(`home_team_id.eq.${opts.teamId},away_team_id.eq.${opts.teamId}`)
    }

    if (opts?.group) qb = qb.eq('group_label', opts.group)
    if (opts?.from) qb = qb.gte('kick_off', opts.from)
    if (opts?.to) qb = qb.lte('kick_off', opts.to)

    qb = qb.order('kick_off', { ascending: true })

    const { data, error } = await qb
    if (error) {
      return { data: [], error: normalizeSupabaseError(error) }
    }

    const syncDataResult = await supabase
      .from('data_sync_logs')
      .select('finished_at')
      .eq('sync_type', 'fixtures')
      .order('finished_at', { ascending: false })
      .limit(1)
      .single() as PostgrestSingleResponse<SyncLogRow>
    const syncData = syncDataResult.data

    return {
      data: (data ?? []) as MatchRow[],
      lastSyncedAt: syncData?.finished_at ?? null,
      error: null,
    }
  } catch (err) {
    return {
      data: [] as MatchRow[],
      error: err instanceof Error ? err : new Error(String(err)),
    }
  }
}

export async function getMatchById(id: string): Promise<ApiResponse<MatchRow | null>> {
  try {
    const { data, error } = await supabase.from('matches').select('*').eq('id', id).single()
    return { data: data ?? null, error: normalizeSupabaseError(error) }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
