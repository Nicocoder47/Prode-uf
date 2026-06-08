/** Código universal de ingreso admin (validado también en Supabase Edge Function). */
export const UNIVERSAL_ADMIN_CODE = '0047'

export function isUniversalAdminCode(code: string): boolean {
  const digits = code.replace(/\D/g, '')
  return digits === UNIVERSAL_ADMIN_CODE
}
