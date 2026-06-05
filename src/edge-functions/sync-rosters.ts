// Template: sync-rosters from SportMonks
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

    // Example endpoint: fetch squads for tournament season
    const r = await fetch(`${SPORTMONKS_BASE_URL}/squads/season/2026?api_token=${SPORTMONKS_API_KEY}`)
    if (!r.ok) throw new Error(`Provider returned ${r.status}`)
    const payload = await r.json()

    // Normalize provider rows
    const rawPlayers: any[] = []
    for (const item of (payload.data || [])) {
      const teamProviderId = item.team_id ?? item.team?.id
      for (const p of item.players || []) {
        rawPlayers.push({
          provider: 'sportmonks',
          provider_player_id: String(p.id),
          provider_team_id: teamProviderId ? String(teamProviderId) : null,
          name: p.fullname ?? p.common_name ?? p.name,
          position: p.position ?? null,
          date_of_birth: p.birthdate ?? null,
          nationality: p.nationality ?? null,
          club: p.current_club ?? null,
          photo_url: p.image_path ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    }

    // Upsert and map provider -> local ids. We upsert one-by-one to capture returned id
    const upsertedCount: number[] = []
    for (const rp of rawPlayers) {
      // Try to find local team id for provider_team_id
      let teamId = null
      if (rp.provider_team_id) {
        const { data: teamData } = await supabase.from('teams').select('id').eq('provider', 'sportmonks').eq('provider_team_id', rp.provider_team_id).limit(1).single()
        teamId = teamData?.id ?? null
      }

      const row = {
        provider: rp.provider,
        provider_player_id: rp.provider_player_id,
        team_id: teamId,
        name: rp.name,
        position: rp.position,
        date_of_birth: rp.date_of_birth,
        nationality: rp.nationality,
        club: rp.club,
        photo_url: rp.photo_url,
        created_at: rp.created_at,
        updated_at: rp.updated_at,
      }

      const { data: upserted, error: upsertErr } = await supabase.from('players').upsert(row, { onConflict: 'provider,provider_player_id' }).select('id').single()
      if (upsertErr) {
        console.error('Upsert player error', upsertErr.message)
      } else {
        upsertedCount.push(1)
        // maintain provider mapping table for traceability
        await supabase.from('provider_mappings').upsert({ provider: 'sportmonks', provider_resource: 'player', provider_resource_id: rp.provider_player_id, local_id: upserted.id }, { onConflict: 'provider,provider_resource,provider_resource_id' })
      }
    }

    await supabase.from('data_sync_logs').insert([{ provider: 'sportmonks', sync_type: 'rosters', status: 'done', records_upserted: upsertedCount.length }])

    return new Response(JSON.stringify({ ok: true, upserted: upsertedCount.length }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
