import { supabase } from './supabase'

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/login'
}
