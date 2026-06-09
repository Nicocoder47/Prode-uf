import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const enabled = Deno.env.get('UNIVERSAL_ADMIN_LOGIN_ENABLED') === 'true';
  if (!enabled) {
    return new Response(JSON.stringify({ error: 'disabled_in_production' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'disabled_in_production' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
