import { createClient } from '@supabase/supabase-js'

function adminSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('Missing VITE_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function normalizeDni(raw: string): string {
  return raw.replace(/\D/g, '')
}

export async function resetUserPasswordToDni(userId: string, actorAccessToken: string) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase env')
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${actorAccessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const adminClient = adminSupabase()

  const { data: actorData, error: actorError } = await userClient.auth.getUser()
  if (actorError || !actorData.user) {
    throw new Error('unauthorized')
  }

  const { data: actorProfile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', actorData.user.id)
    .maybeSingle()

  if (actorProfile?.role !== 'admin') {
    throw new Error('forbidden')
  }

  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('id,email,dni,role,deleted_at,is_active')
    .eq('id', userId)
    .maybeSingle()

  if (targetError) throw targetError
  if (!target) throw new Error('user_not_found')
  if (target.deleted_at || target.is_active === false) throw new Error('account_disabled')
  if (target.role === 'admin') throw new Error('cannot_reset_admin_password')

  const dni = normalizeDni(String(target.dni ?? ''))
  if (dni.length < 7 || dni.length > 8) throw new Error('dni_required')

  const authRes = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: dni, email_confirm: true }),
  })

  if (!authRes.ok) {
    throw new Error((await authRes.text()) || 'auth_update_failed')
  }

  const { error: markError } = await userClient.rpc('admin_mark_password_reset_to_dni', {
    p_user_id: userId,
  })
  if (markError) throw markError

  return { ok: true, user_id: userId, email: target.email }
}
