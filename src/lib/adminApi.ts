import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/** Fetch autenticado para endpoints /api/admin/* (Bearer JWT de Supabase). */
export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
