/** Supabase cloud Prode uf — anon key es pública (RLS); fallback si Vercel no tiene env vars. */
export const PRODUCTION_SUPABASE = {
  url: 'https://irklqwsnehlfcgehvscm.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlya2xxd3NuZWhsZmNnZWh2c2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzIxMzcsImV4cCI6MjA5NjI0ODEzN30.IZdvjieoofr0G9V7WupI782jbKbB-A3l7AJ6JJID3UA',
} as const

export function resolveSupabaseClientConfig() {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim() || PRODUCTION_SUPABASE.url
  const anonKey =
    String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim() || PRODUCTION_SUPABASE.anonKey
  return { url, anonKey }
}
