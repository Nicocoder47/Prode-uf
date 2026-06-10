/** En producción no usar fallback admin que lee tablas directas. */
export const ADMIN_RPC_FAIL_MESSAGE =
  'RPC admin no disponible. Aplicar migraciones pendientes en Supabase.';

export function isProductionBuild(): boolean {
  return import.meta.env.PROD === true
}

export function shouldFailClosedOnAdminRpc(): boolean {
  return isProductionBuild()
}
