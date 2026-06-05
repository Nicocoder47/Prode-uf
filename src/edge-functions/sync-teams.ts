// Template Supabase Edge Function (TypeScript) — sync-teams
// Populates `teams` table with provider data and writes to `provider_mappings` and `data_sync_logs`.
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

    const teamsUrl = `${SPORTMONKS_BASE_URL}/teams?api_token=${SPORTMONKS_API_KEY}`
    const r = await fetch(teamsUrl)
    if (!r.ok) throw new Error(`Provider returned ${r.status}`)
    const payload = await r.json()

    const rows = (payload.data || []).map((t: any) => ({
      provider: 'sportmonks',
      provider_team_id: String(t.id),
      name: t.name,
      code: t.code ?? t.short_code ?? null,
      flag_url: t.logo_path ?? null,
      group_label: t.group ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const { data, error } = await supabase.from('teams').upsert(rows, { onConflict: 'provider,provider_team_id' })

    await supabase.from('data_sync_logs').insert([{ provider: 'sportmonks', sync_type: 'teams', status: error ? 'error' : 'done', records_upserted: (data || []).length, error_message: error?.message ?? null }])

    return new Response(JSON.stringify({ ok: true, inserted: (data || []).length, error: error?.message }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
