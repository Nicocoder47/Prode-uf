import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeCode(code: string): string {
  return code.replace(/\D/g, '');
}

function normalizePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, '');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const expectedCode = Deno.env.get('UNIVERSAL_ADMIN_CODE') ?? '0047';

    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'missing_env' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? '');
    const email = String(body.email ?? '').trim().toLowerCase();
    const fullName = String(body.full_name ?? body.fullName ?? '').trim();
    const domainPlate = normalizePlate(String(body.domain_plate ?? body.domainPlate ?? ''));

    if (normalizeCode(code) !== normalizeCode(expectedCode)) {
      return new Response(JSON.stringify({ error: 'invalid_code' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email.includes('@')) {
      return new Response(JSON.stringify({ error: 'invalid_email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!fullName) {
      return new Response(JSON.stringify({ error: 'full_name_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!domainPlate) {
      return new Response(JSON.stringify({ error: 'domain_plate_required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: validation } = await admin.rpc('validate_registration', {
      p_email: email,
      p_domain_plate: domainPlate,
    });

    if (validation && validation.ok === false) {
      return new Response(JSON.stringify({ error: validation.code ?? 'validation_failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        data: { full_name: fullName, domain_plate: domainPlate },
      },
    });

    if (linkErr || !linkData?.properties) {
      return new Response(JSON.stringify({ error: linkErr?.message ?? 'link_failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const otp = linkData.properties.email_otp;
    const tokenHash = linkData.properties.hashed_token;

    let session = null;

    if (otp) {
      const { data: verified, error: verifyErr } = await admin.auth.verifyOtp({
        email,
        token: String(otp),
        type: 'email',
      });
      if (verifyErr) {
        return new Response(JSON.stringify({ error: verifyErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      session = verified.session;
    } else if (tokenHash) {
      const { data: verified, error: verifyErr } = await admin.auth.verifyOtp({
        token_hash: String(tokenHash),
        type: 'email',
      });
      if (verifyErr) {
        return new Response(JSON.stringify({ error: verifyErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      session = verified.session;
    }

    if (!session?.access_token || !session.refresh_token) {
      return new Response(JSON.stringify({ error: 'session_failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: profileErr } = await admin.rpc('sync_user_profile_admin', {
      p_user_id: session.user.id,
      p_full_name: fullName,
      p_domain_plate: domainPlate,
      p_email: email,
    });

    if (profileErr) {
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
        role: 'admin',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
