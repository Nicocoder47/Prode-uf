import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

/** Cliente Supabase para scripts Node < 22 (requiere transport ws). */
export function createNodeSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}
