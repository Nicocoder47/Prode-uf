// Template Supabase Edge Function (TypeScript) — sync-fixtures
// Deployment: Supabase Edge Functions (Deno) or adapt to your provider.
// Environment variables required (set in deployment):
// - SPORTMONKS_API_KEY
// - SPORTMONKS_BASE_URL
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

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

    // NOTE: adapt endpoint path to your SportMonks plan/version
    const fixturesUrl = `${SPORTMONKS_BASE_URL}/fixtures/season/2026?api_token=${SPORTMONKS_API_KEY}`
    const r = await fetch(fixturesUrl)
    if (!r.ok) throw new Error(`Provider returned ${r.status}`)
    const payload = await r.json()

    // Normalization: map provider fixtures to our matches table format
    const rows = (payload.data || []).map((f: any) => ({
      provider: 'sportmonks',
      provider_match_id: String(f.id),
      kick_off: f.time?.starting_at ?? f.utc_date ?? null,
      stadium: f.venue?.name ?? null,
      city: f.venue?.city ?? null,
      provider: 'sportmonks',
      home_team_id: null,
      away_team_id: null,
      status: f.status ?? 'scheduled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    // Upsert idempotente on (provider, provider_match_id)
    const { data, error } = await supabase.from('matches').upsert(rows, { onConflict: 'provider,provider_match_id' })

    // Log sync
    await supabase.from('data_sync_logs').insert([{ provider: 'sportmonks', sync_type: 'fixtures', status: error ? 'error' : 'done', records_upserted: (data || []).length, error_message: error?.message ?? null }])

    return new Response(JSON.stringify({ ok: true, inserted: (data || []).length, error: error?.message }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
