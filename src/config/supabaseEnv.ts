/** Supabase cloud Prode uf — anon key es pública (RLS); fallback si Vercel no tiene env vars. */
export const PRODUCTION_SUPABASE = {
  url: 'https://irklqwsnehlfcgehvscm.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlya2xxd3NuZWhsZmNnZWh2c2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzIxMzcsImV4cCI6MjA5NjI0ODEzN30.IZdvjieoofr0G9V7WupI782jbKbB-A3l7AJ6JJID3UA',
} as const

function isLocalSupabaseUrl(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(url)
}

export function resolveSupabaseClientConfig() {
  let url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  let anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

  // Vite inyecta env en build: un .env local puede quedar horneado en prod.
  if (import.meta.env.PROD && (!url || isLocalSupabaseUrl(url))) {
    url = PRODUCTION_SUPABASE.url
    anonKey = PRODUCTION_SUPABASE.anonKey
  }

  if (!url) url = PRODUCTION_SUPABASE.url
  if (!anonKey) anonKey = PRODUCTION_SUPABASE.anonKey

  return { url, anonKey }
}
