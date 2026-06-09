import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function unauthorized(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const expectedSecret = Deno.env.get('SCORE_MATCH_SECRET');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing env' }), { status: 500 });
    }

    if (!expectedSecret) {
      return new Response(JSON.stringify({ error: 'score_match_disabled' }), { status: 503 });
    }

    const providedSecret = req.headers.get('x-score-match-secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!providedSecret || providedSecret !== expectedSecret) {
      return unauthorized('invalid_secret');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const matchId = body.match_id ?? new URL(req.url).searchParams.get('match_id');

    if (!matchId) {
      return new Response(JSON.stringify({ error: 'match_id required' }), { status: 400 });
    }

    const { data, error } = await supabase.rpc('score_match_predictions', { p_match_id: matchId });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, predictions_scored: data }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
