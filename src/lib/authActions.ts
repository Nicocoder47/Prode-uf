import { supabase } from './supabase'
import { clearGlobalAlertDismiss } from '../utils/globalAlertSession.ts'

export async function signOut() {
  clearGlobalAlertDismiss()
  await supabase.auth.signOut()
  window.location.href = '/login'
}
