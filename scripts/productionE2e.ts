/**
 * Prueba punta a punta production — predicción, bloqueo, scoring, anti-duplicación.
 *
 * Requiere: .env.cloud con SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_ANON_KEY
 *
 * Uso:
 *   npm run test:production-e2e
 *   npm run test:production-e2e -- --match-id=<uuid>   (partido scheduled futuro)
 *
 * Arquitectura:
 *   serviceAdmin — service_role, nunca signIn; mutaciones admin y scoring
 *   userClient  — anon + JWT usuario; save_prediction y checks negativos
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import ws from 'ws';

const supabaseClientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
} as const;

function createE2eClient(key: string, accessToken?: string) {
  return createClient(url!, key, {
    ...supabaseClientOptions,
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  });
}

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile('.env.cloud');
loadEnvFile('.env');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (.env.cloud)');
  process.exit(1);
}

if (!anonKey) {
  console.error('Falta VITE_SUPABASE_ANON_KEY (.env.cloud) — requerido para userClient');
  process.exit(1);
}

/** Solo operaciones admin/scoring. Nunca signInWithPassword aquí. */
const serviceAdmin = createE2eClient(serviceKey);

const matchIdArg = process.argv.find(a => a.startsWith('--match-id='))?.split('=')[1];

type Step = { name: string; ok: boolean; detail?: string };

const steps: Step[] = [];
function pass(name: string, detail?: string) {
  steps.push({ name, ok: true, detail });
  console.log(`✔ ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name: string, detail?: string) {
  steps.push({ name, ok: false, detail });
  console.error(`✘ ${name}${detail ? ` — ${detail}` : ''}`);
}

function isPermissionDenied(message?: string, code?: string) {
  return code === '42501' || message?.includes('permission denied') || message?.includes('forbidden');
}

async function main() {
  console.log('\n=== PRODEMUNDIAL — Production E2E ===\n');

  // 1) Funciones SQL — serviceAdmin (service_role), sin sesión de usuario
  const { error: fnErr } = await serviceAdmin.rpc('score_match_predictions', {
    p_match_id: '00000000-0000-0000-0000-000000000001',
  });
  if (fnErr && (fnErr.message.includes('function') || fnErr.code === '42883')) {
    fail('score_match_predictions existe (service_role)', fnErr.message);
  } else {
    pass('score_match_predictions callable (service_role)');
  }

  const { error: rescoreErr } = await serviceAdmin.rpc('rescore_match_predictions', {
    p_match_id: '00000000-0000-0000-0000-000000000001',
    p_old_score_home: 0,
    p_old_score_away: 0,
  });
  if (rescoreErr && (rescoreErr.message.includes('function') || rescoreErr.code === '42883')) {
    fail('rescore_match_predictions existe', rescoreErr.message);
  } else {
    pass('rescore_match_predictions callable (service_role)');
  }

  // 2) Buscar partido de prueba (scheduled, kickoff futuro)
  let matchId = matchIdArg;
  let matchBackup: { kick_off: string; status: string; is_locked: boolean } | null = null;

  if (!matchId) {
    const { data: matches, error } = await serviceAdmin
      .from('matches')
      .select('id,kick_off,status,is_locked,home_team_id,away_team_id')
      .eq('status', 'scheduled')
      .eq('is_locked', false)
      .gt('kick_off', new Date(Date.now() + 86400000).toISOString())
      .order('kick_off')
      .limit(1);
    if (error || !matches?.[0]) {
      fail('Partido scheduled futuro para prueba', error?.message ?? 'ninguno encontrado');
      printSummary();
      process.exit(1);
    }
    matchId = matches[0].id;
    matchBackup = {
      kick_off: matches[0].kick_off,
      status: matches[0].status,
      is_locked: matches[0].is_locked,
    };
    pass('Partido de prueba', matchId);
  } else {
    const { data: m } = await serviceAdmin
      .from('matches')
      .select('kick_off,status,is_locked')
      .eq('id', matchId)
      .single();
    if (m) matchBackup = { kick_off: m.kick_off, status: m.status, is_locked: m.is_locked };
  }

  // 3) Setup usuario — serviceAdmin crea; userClient autentica por separado
  const testEmail = `e2e-${Date.now()}@prodemundial.test`;
  const testPassword = `E2e_${Date.now()}_x!`;

  const { data: signUp, error: signUpErr } = await serviceAdmin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (signUpErr || !signUp.user) {
    fail('Crear usuario E2E', signUpErr?.message);
    printSummary();
    process.exit(1);
  }
  const userId = signUp.user.id;
  pass('Usuario E2E creado', testEmail);

  await serviceAdmin.from('profiles').upsert({
    id: userId,
    email: testEmail,
    full_name: 'E2E Test',
    role: 'member',
    token_balance: 0,
    is_active: true,
  });

  const loginClient = createE2eClient(anonKey);
  const { data: signIn, error: signInErr } = await loginClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (signInErr || !signIn.session) {
    fail('Login usuario E2E', signInErr?.message);
    await serviceAdmin.auth.admin.deleteUser(userId);
    printSummary();
    process.exit(1);
  }
  pass('Login real Supabase');

  /** Solo acciones de usuario común: save_prediction y checks negativos. */
  const userClient = createE2eClient(anonKey, signIn.session.access_token);
  const anonClient = createE2eClient(anonKey);

  const { error: anonLegajoErr } = await anonClient.rpc('validate_member_legajo', {
    p_legajo: '0000',
    p_dni: '00000000',
  });
  if (isPermissionDenied(anonLegajoErr?.message, anonLegajoErr?.code)) {
    pass('anon no puede validate_member_legajo', anonLegajoErr!.message);
  } else if (!anonLegajoErr) {
    fail('anon debería estar bloqueado en validate_member_legajo');
  } else {
    pass('anon bloqueado en validate_member_legajo', anonLegajoErr.message);
  }

  const { error: userScoreErr } = await userClient.rpc('score_match_predictions', {
    p_match_id: matchId,
  });
  if (isPermissionDenied(userScoreErr?.message, userScoreErr?.code)) {
    pass('authenticated no puede score_match_predictions', userScoreErr!.message);
  } else if (!userScoreErr) {
    fail('authenticated debería estar bloqueado en score_match_predictions');
  } else {
    pass('authenticated bloqueado en score_match_predictions', userScoreErr.message);
  }

  const { error: userRescoreErr } = await userClient.rpc('rescore_match_predictions', {
    p_match_id: matchId,
    p_old_score_home: 0,
    p_old_score_away: 0,
  });
  if (isPermissionDenied(userRescoreErr?.message, userRescoreErr?.code)) {
    pass('authenticated no puede rescore_match_predictions', userRescoreErr!.message);
  } else if (!userRescoreErr) {
    fail('authenticated debería estar bloqueado en rescore_match_predictions');
  } else {
    pass('authenticated bloqueado en rescore_match_predictions', userRescoreErr.message);
  }

  // 4) Predicción vía RPC (usuario)
  const { error: predErr } = await userClient.rpc('save_prediction', {
    p_match_id: matchId,
    p_score_home: 2,
    p_score_away: 1,
  });
  if (predErr) {
    fail('Guardar predicción', predErr.message);
  } else {
    pass('Predicción guardada (2-1 local)');
  }

  const otherEmail = `e2e-other-${Date.now()}@prodemundial.test`;
  const { data: otherSignUp } = await serviceAdmin.auth.admin.createUser({
    email: otherEmail,
    password: testPassword,
    email_confirm: true,
  });
  const otherUserId = otherSignUp?.user?.id;
  if (otherUserId) {
    await serviceAdmin.from('profiles').upsert({
      id: otherUserId,
      email: otherEmail,
      full_name: 'E2E Other',
      role: 'member',
      token_balance: 0,
      is_active: true,
    });
    await serviceAdmin.from('predictions').insert({
      user_id: otherUserId,
      match_id: matchId,
      predicted_winner: 'home',
      predicted_score_home: 0,
      predicted_score_away: 0,
      status: 'pending',
    });
    const { data: foreignRows, error: foreignErr } = await userClient
      .from('predictions')
      .update({ predicted_score_home: 9 })
      .eq('user_id', otherUserId)
      .eq('match_id', matchId)
      .select('id');
    if (foreignErr || !foreignRows?.length) {
      pass('usuario no modifica predicción ajena', foreignErr?.message ?? '0 filas');
    } else {
      fail('RLS debería bloquear update de predicción ajena');
    }
    await serviceAdmin.from('predictions').delete().eq('user_id', otherUserId);
    await serviceAdmin.auth.admin.deleteUser(otherUserId);
  } else {
    fail('Crear usuario auxiliar para check RLS ajena');
  }

  // 5) Partido live → save_prediction debe rechazar (serviceAdmin muta; userClient intenta)
  await serviceAdmin.from('matches').update({ status: 'live', is_locked: true }).eq('id', matchId);
  const { error: blockErr } = await userClient.rpc('save_prediction', {
    p_match_id: matchId,
    p_score_home: 0,
    p_score_away: 3,
  });
  if (blockErr) {
    pass('save_prediction rechaza partido live', blockErr.message);
  } else {
    fail('save_prediction debería rechazar cuando partido está live');
  }

  // 6) Finalizar y puntuar — solo serviceAdmin
  await serviceAdmin
    .from('matches')
    .update({ status: 'finished', score_home: 2, score_away: 1, scored_at: null, is_locked: true })
    .eq('id', matchId);

  const { data: scored1, error: scoreErr1 } = await serviceAdmin.rpc('score_match_predictions', {
    p_match_id: matchId,
  });
  if (scoreErr1) {
    fail('Primer scoring', scoreErr1.message);
  } else {
    pass('Primer scoring', `${scored1} predicciones`);
  }

  const { data: pred1 } = await serviceAdmin
    .from('predictions')
    .select('points,status')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .single();
  if (pred1?.points === 5 && pred1.status === 'scored') {
    pass('Puntos correctos (marcador exacto = 5)');
  } else {
    fail('Puntos esperados 5', `got ${pred1?.points} status=${pred1?.status}`);
  }

  const { data: lb1 } = await serviceAdmin
    .from('leaderboard')
    .select('points')
    .eq('user_id', userId)
    .eq('period', 'global')
    .maybeSingle();
  if ((lb1?.points ?? 0) >= 5) {
    pass('Leaderboard actualizado', `${lb1?.points} pts`);
  } else {
    fail('Leaderboard sin puntos', String(lb1?.points));
  }

  // 7) Anti-duplicación: segundo scoring
  const { data: scored2, error: scoreErr2 } = await serviceAdmin.rpc('score_match_predictions', {
    p_match_id: matchId,
  });
  if (scoreErr2) {
    fail('Segundo scoring', scoreErr2.message);
  } else if (scored2 === 0) {
    pass('Segundo scoring no duplica (retorna 0)');
  } else {
    fail('Doble scoring detectado', `segunda corrida=${scored2}`);
  }

  const { data: lb2 } = await serviceAdmin
    .from('leaderboard')
    .select('points')
    .eq('user_id', userId)
    .eq('period', 'global')
    .maybeSingle();
  if (lb2?.points === lb1?.points) {
    pass('Leaderboard estable tras re-sync');
  } else {
    fail('Leaderboard cambió tras segundo scoring', `${lb1?.points} → ${lb2?.points}`);
  }

  // 8) Rescore admin (corregir marcador 2-1 → 1-1 vía trigger)
  const { error: fixErr } = await serviceAdmin
    .from('matches')
    .update({ score_home: 1, score_away: 1 })
    .eq('id', matchId);
  if (fixErr) {
    fail('Actualizar marcador admin', fixErr.message);
  } else {
    pass('Marcador corregido a 1-1 (trigger rescore)');
  }

  const { data: pred2 } = await serviceAdmin
    .from('predictions')
    .select('points,status')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .single();
  if (pred2?.points === 0 && pred2?.status === 'scored') {
    pass('Tras corrección 1-1 ya no hay marcador exacto (0 pts)');
  } else if (pred2?.points === 5) {
    fail('Rescore no aplicado', `points=${pred2?.points}`);
  } else {
    pass('Puntos tras rescore', `${pred2?.points} (${pred2?.status})`);
  }

  // Cleanup — serviceAdmin
  await serviceAdmin.from('predictions').delete().eq('user_id', userId);
  await serviceAdmin.from('leaderboard').delete().eq('user_id', userId);
  if (matchBackup) {
    await serviceAdmin
      .from('matches')
      .update({
        status: matchBackup.status,
        kick_off: matchBackup.kick_off,
        score_home: null,
        score_away: null,
        is_locked: matchBackup.is_locked,
        scored_at: null,
      })
      .eq('id', matchId);
  } else {
    await serviceAdmin
      .from('matches')
      .update({ status: 'scheduled', score_home: null, score_away: null, is_locked: false, scored_at: null })
      .eq('id', matchId);
  }
  await serviceAdmin.auth.admin.deleteUser(userId);
  pass('Cleanup E2E');

  printSummary();
  process.exit(steps.some(s => !s.ok) ? 1 : 0);
}

function printSummary() {
  const ok = steps.filter(s => s.ok).length;
  const bad = steps.filter(s => !s.ok).length;
  console.log(`\n=== Resultado: ${ok} OK, ${bad} FAIL ===\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
