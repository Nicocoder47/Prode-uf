// Template: sync-lineups (probable and official) from provider
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

serve(async (req: Request) => {
  try {
    const SPORTMONKS_API_KEY = Deno.env.get('SPORTMONKS_API_KEY')
    const SPORTMONKS_BASE_URL = Deno.env.get('SPORTMONKS_BASE_URL')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SPORTMONKS_API_KEY || !SPORTMONKS_BASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Example: provider endpoint returning lineups for upcoming matches
    const r = await fetch(`${SPORTMONKS_BASE_URL}/lineups/season/2026?api_token=${SPORTMONKS_API_KEY}`)
    if (!r.ok) throw new Error(`Provider returned ${r.status}`)
    const payload = await r.json()

    const rows: any[] = []
    for (const item of (payload.data || [])) {
      for (const pl of (item.players || [])) {
        // resolve local ids
        let matchId = null
        if (item.match_id) {
          const { data: m } = await supabase.from('matches').select('id').eq('provider', 'sportmonks').eq('provider_match_id', String(item.match_id)).limit(1).single()
          matchId = m?.id ?? null
        }

        let teamId = null
        const teamProviderId = pl.team_id ?? item.team_id
        if (teamProviderId) {
          const { data: t } = await supabase.from('teams').select('id').eq('provider', 'sportmonks').eq('provider_team_id', String(teamProviderId)).limit(1).single()
          teamId = t?.id ?? null
        }

        let playerId = null
        const { data: p } = await supabase.from('players').select('id').eq('provider', 'sportmonks').eq('provider_player_id', String(pl.player_id)).limit(1).single()
        playerId = p?.id ?? null

        rows.push({
          provider: 'sportmonks',
          match_provider_id: String(item.match_id),
          match_id: matchId,
          team_provider_id: teamProviderId ? String(teamProviderId) : null,
          team_id: teamId,
          player_provider_id: String(pl.player_id),
          player_id: playerId,
          role: pl.role,
          position: pl.position,
          provider_lineup_id: String(item.id ?? ''),
          confirmed_at: pl.confirmed_at ?? null,
          updated_at: new Date().toISOString(),
        })
      }
    }

    const { data, error } = await supabase.from('lineups').upsert(rows, { onConflict: 'match_id,team_id,player_id,provider_lineup_id' })

    await supabase.from('data_sync_logs').insert([{ provider: 'sportmonks', sync_type: 'lineups', status: error ? 'error' : 'done', records_upserted: (data || []).length, error_message: error?.message ?? null }])

    return new Response(JSON.stringify({ ok: true, upserted: (data || []).length, error: error?.message }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
