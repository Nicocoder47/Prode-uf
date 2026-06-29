import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeDni(raw: string): string {
  return raw.replace(/\D/g, '')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'missing_env' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: { user_id?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const userId = body.user_id?.trim()
  if (!userId) {
    return json({ error: 'user_id_required' }, 400)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: actorData, error: actorError } = await userClient.auth.getUser()
  if (actorError || !actorData.user) {
    return json({ error: 'unauthorized' }, 401)
  }

  const { data: actorProfile, error: actorProfileError } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', actorData.user.id)
    .maybeSingle()

  if (actorProfileError || actorProfile?.role !== 'admin') {
    return json({ error: 'forbidden' }, 403)
  }

  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('id,email,dni,role,deleted_at,is_active')
    .eq('id', userId)
    .maybeSingle()

  if (targetError) {
    return json({ error: targetError.message }, 500)
  }
  if (!target) {
    return json({ error: 'user_not_found' }, 404)
  }
  if (target.deleted_at) {
    return json({ error: 'account_deleted' }, 400)
  }
  if (target.role === 'admin') {
    return json({ error: 'cannot_reset_admin_password' }, 400)
  }

  const dni = normalizeDni(String(target.dni ?? ''))
  if (dni.length < 7 || dni.length > 8) {
    return json({ error: 'dni_required' }, 400)
  }

  const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      password: dni,
      email_confirm: true,
    }),
  })

  if (!authRes.ok) {
    const detail = await authRes.text()
    return json({ error: detail || 'auth_update_failed' }, 500)
  }

  const { data: markData, error: markError } = await userClient.rpc('admin_mark_password_reset_to_dni', {
    p_user_id: userId,
  })

  if (markError) {
    return json({ error: markError.message }, 500)
  }

  return json({
    ok: true,
    user_id: userId,
    email: target.email,
    dni,
    mark: markData,
  })
})
