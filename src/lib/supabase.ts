import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resolveSupabaseClientConfig } from '../config/supabaseEnv.ts'

const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseClientConfig()
const missingSupabaseCredentials = !supabaseUrl || !supabaseAnonKey

if (missingSupabaseCredentials) {
  // eslint-disable-next-line no-console
  console.warn('Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

const stubSupabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_: unknown) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOtp: async (_: unknown) => ({ data: null, error: new Error('Supabase not configured') }),
    signUp: async (_: unknown) => ({ data: null, error: new Error('Supabase not configured') }),
    signInWithPassword: async (_: unknown) => ({ data: null, error: new Error('Supabase not configured') }),
    signOut: async () => ({ data: null, error: null }),
  },
  from: (_table: string) => ({
    select: (_columns: string) => ({
      eq: (_column: string, _value: unknown) => ({
        single: async () => ({ data: null, error: new Error('Supabase not configured') }),
        order: (_column: string, _opts?: { ascending: boolean }) => ({
          limit: async (_count: number) => ({ data: null, error: new Error('Supabase not configured') }),
        }),
      }),
      order: (_column: string, _opts?: { ascending: boolean }) => ({
        limit: async (_count: number) => ({ data: null, error: new Error('Supabase not configured') }),
      }),
    }),
  }),
  rpc: async (_fn: string, _params?: unknown) => ({ data: null, error: new Error('Supabase not configured') }),
} as unknown as SupabaseClient

const supabase: SupabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      })
    : stubSupabase

export { supabase }
