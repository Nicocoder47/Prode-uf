import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

/** Admin panel requiere backend Express — desactivado en modo Supabase-only (Vercel $0). */
export function isAdminApiAvailable(): boolean {
  return Boolean(API_BASE.trim());
}

/** Fetch autenticado para endpoints /api/admin/* (Bearer JWT de Supabase). */
export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!isAdminApiAvailable()) {
    throw new Error(
      'Panel admin requiere backend Express. En producción $0 usá Supabase Dashboard y GitHub Actions (docs/production-zero-cost.md).'
    );
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${API_BASE}${path}`, { ...init, headers });
}
