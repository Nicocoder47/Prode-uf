// Template Supabase Edge Function (TypeScript) — webhooks/live-events
// Receives live events from provider (goals, cards, substitutions, lineup_confirmed)
// Verify signature if provider supports HMAC, then normalize and upsert to `events` and update `matches`/`lineups`.
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

serve(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response('Missing env', { status: 500 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json().catch(() => null)
    if (!body) return new Response('Invalid body', { status: 400 })

    // Example: { type: 'goal', match_id: '123', provider_event_id: 'evt_456', payload: {...} }
    const type = body.type || 'unknown'
    const provider_event_id = body.provider_event_id || body.id || null
    const match_provider_id = body.match_id || body.match_provider_id || null

    // try to find match local id via provider_mappings or matches table
    let match: any = null
    if (match_provider_id) {
      const m = await supabase.from('matches').select('id,provider,provider_match_id').eq('provider_match_id', String(match_provider_id)).single()
      match = m.data
    }

    // insert event record
    await supabase.from('events').insert([{ provider: body.provider || 'sportmonks', provider_event_id: provider_event_id, match_id: match?.id ?? null, type, payload: body, captured_at: new Date().toISOString() }])

    // if lineup_confirmed -> update matches.is_locked and lineups
    if (type === 'lineup_confirmed' && match?.id) {
      await supabase.from('matches').update({ is_locked: true }).eq('id', match.id)
      // upsert lineups (payload must contain team_lineups)
      const teams = body.teams || []
      for (const team of teams) {
        for (const pl of team.players || []) {
          await supabase.from('lineups').upsert([{ match_id: match.id, team_id: team.local_team_id ?? null, player_id: pl.local_player_id ?? null, role: pl.role, position: pl.position, source: body.provider }], { onConflict: 'match_id,team_id,player_id,source' })
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }))
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
