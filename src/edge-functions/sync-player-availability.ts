// Template: sync-player-availability (injuries/suspensions)
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

    const r = await fetch(`${SPORTMONKS_BASE_URL}/injuries/season/2026?api_token=${SPORTMONKS_API_KEY}`)
    if (!r.ok) throw new Error(`Provider returned ${r.status}`)
    const payload = await r.json()

    const rows: any[] = []
    for (const it of (payload.data || [])) {
      // Try to resolve player local id
      const { data: p } = await supabase.from('players').select('id').eq('provider', 'sportmonks').eq('provider_player_id', String(it.player_id)).limit(1).single()
      const playerId = p?.id ?? null

      rows.push({
        provider: 'sportmonks',
        provider_player_id: String(it.player_id),
        player_id: playerId,
        status: it.type ?? 'injured',
        reason: it.description ?? null,
        expected_return: it.expected_return ?? null,
        confidence: it.confidence ?? null,
        source: 'sportmonks',
        captured_at: new Date().toISOString(),
        is_active: true,
      })
    }

    const { data, error } = await supabase.from('player_availability').upsert(rows, { onConflict: 'provider,provider_player_id' })

    await supabase.from('data_sync_logs').insert([{ provider: 'sportmonks', sync_type: 'availability', status: error ? 'error' : 'done', records_upserted: (data || []).length, error_message: error?.message ?? null }])

    return new Response(JSON.stringify({ ok: true, upserted: (data || []).length, error: error?.message }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
