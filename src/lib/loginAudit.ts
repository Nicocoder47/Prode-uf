import { supabase } from './supabase'

export async function reportLoginAttempt(input: {
  email: string
  success: boolean
  errorCode?: string | null
  errorMessage?: string | null
  attemptType?: 'login' | 'register'
}) {
  try {
    await supabase.rpc('log_login_attempt', {
      p_email: input.email.trim().toLowerCase(),
      p_success: input.success,
      p_error_code: input.errorCode ?? null,
      p_error_message: input.errorMessage ?? null,
      p_attempt_type: input.attemptType ?? 'login',
    })
  } catch {
    // No bloquear el flujo de login si falla el registro de auditoría.
  }
}
