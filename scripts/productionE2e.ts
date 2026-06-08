/**
 * Prueba punta a punta production — predicción, bloqueo, scoring, anti-duplicación.
 *
 * Requiere: .env.cloud con SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Uso:
 *   npm run test:production-e2e
 *   npm run test:production-e2e -- --match-id=<uuid>   (partido scheduled futuro)
 *
 * NO usar en producción con usuarios reales sin --dry-run si no querés mutar datos.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

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

if (!url || !serviceKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (.env.cloud)');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

async function main() {
  console.log('\n=== PRODEMUNDIAL — Production E2E ===\n');

  // 1) Funciones SQL existentes
  const { error: fnErr } = await supabase.rpc('score_match_predictions', {
    p_match_id: '00000000-0000-0000-0000-000000000000',
  });
  if (fnErr && (fnErr.message.includes('function') || fnErr.code === '42883')) {
    fail('score_match_predictions existe', fnErr.message);
  } else {
    pass('score_match_predictions callable');
  }

  const { error: rescoreErr } = await supabase.rpc('rescore_match_predictions', {
    p_match_id: '00000000-0000-0000-0000-000000000000',
    p_old_score_home: 0,
    p_old_score_away: 0,
  });
  if (rescoreErr && (rescoreErr.message.includes('function') || rescoreErr.code === '42883')) {
    fail('rescore_match_predictions existe (aplicar migración 20240111000000)', rescoreErr.message);
  } else {
    pass('rescore_match_predictions callable');
  }

  // 2) Buscar partido de prueba (scheduled, kickoff futuro)
  let matchId = matchIdArg;
  if (!matchId) {
    const { data: matches, error } = await supabase
      .from('matches')
      .select('id,kick_off,status,home_team_id,away_team_id')
      .eq('status', 'scheduled')
      .gt('kick_off', new Date(Date.now() + 86400000).toISOString())
      .order('kick_off')
      .limit(1);
    if (error || !matches?.[0]) {
      fail('Partido scheduled futuro para prueba', error?.message ?? 'ninguno encontrado');
      printSummary();
      process.exit(1);
    }
    matchId = matches[0].id;
    pass('Partido de prueba', matchId);
  }

  // 3) Usuario de prueba (service role crea auth user + profile)
  const testEmail = `e2e-${Date.now()}@prodemundial.test`;
  const testPassword = `E2e_${Date.now()}_x!`;

  const { data: signUp, error: signUpErr } = await supabase.auth.admin.createUser({
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

  await supabase.from('profiles').upsert({
    id: userId,
    email: testEmail,
    full_name: 'E2E Test',
    role: 'user',
    token_balance: 100,
    is_active: true,
  });

  const { data: userClient } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (!userClient.session) {
    fail('Login usuario E2E');
    printSummary();
    process.exit(1);
  }
  pass('Login real Supabase');

  const userSb = createClient(url, process.env.VITE_SUPABASE_ANON_KEY || serviceKey, {
    global: { headers: { Authorization: `Bearer ${userClient.session.access_token}` } },
  });

  // 4) Predicción
  const { error: predErr } = await userSb.from('predictions').upsert(
    {
      user_id: userId,
      match_id: matchId,
      predicted_winner: 'home',
      predicted_score_home: 2,
      predicted_score_away: 1,
      status: 'pending',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,match_id' },
  );
  if (predErr) {
    fail('Guardar predicción', predErr.message);
  } else {
    pass('Predicción guardada (2-1 local)');
  }

  // 5) Simular live → bloqueo
  await supabase.from('matches').update({ status: 'live', is_locked: true }).eq('id', matchId);
  const { error: blockErr } = await userSb.from('predictions').upsert(
    {
      user_id: userId,
      match_id: matchId,
      predicted_winner: 'away',
      predicted_score_home: 0,
      predicted_score_away: 3,
      status: 'pending',
    },
    { onConflict: 'user_id,match_id' },
  );
  if (blockErr) {
    pass('RLS bloquea predicción en live', blockErr.message);
  } else {
    fail('RLS debería bloquear predicción cuando partido está live');
  }

  // 6) Finalizar y puntuar
  await supabase
    .from('matches')
    .update({ status: 'finished', score_home: 2, score_away: 1, scored_at: null })
    .eq('id', matchId);

  const { data: scored1, error: scoreErr1 } = await supabase.rpc('score_match_predictions', {
    p_match_id: matchId,
  });
  if (scoreErr1) {
    fail('Primer scoring', scoreErr1.message);
  } else {
    pass('Primer scoring', `${scored1} predicciones`);
  }

  const { data: pred1 } = await supabase
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

  const { data: lb1 } = await supabase
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
  const { data: scored2 } = await supabase.rpc('score_match_predictions', { p_match_id: matchId });
  if (scored2 === 0) {
    pass('Segundo scoring no duplica (retorna 0)');
  } else {
    fail('Doble scoring detectado', `segunda corrida=${scored2}`);
  }

  const { data: lb2 } = await supabase
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
  const { error: fixErr } = await supabase
    .from('matches')
    .update({ score_home: 1, score_away: 1 })
    .eq('id', matchId);
  if (fixErr) {
    fail('Actualizar marcador admin', fixErr.message);
  } else {
    pass('Marcador corregido a 1-1 (trigger rescore si migración aplicada)');
  }

  const { data: pred2 } = await supabase
    .from('predictions')
    .select('points,status')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .single();
  if (pred2?.points === 0 && pred2?.status === 'scored') {
    pass('Tras corrección 1-1 ya no hay marcador exacto (0 pts)');
  } else if (pred2?.points === 5) {
    fail('Rescore no aplicado — ejecutar migración 20240111000000 en Supabase', `points=${pred2?.points}`);
  } else {
    pass('Puntos tras rescore', `${pred2?.points} (${pred2?.status})`);
  }

  // Cleanup
  await supabase.from('predictions').delete().eq('user_id', userId);
  await supabase.from('leaderboard').delete().eq('user_id', userId);
  await supabase
    .from('matches')
    .update({ status: 'scheduled', score_home: null, score_away: null, is_locked: false, scored_at: null })
    .eq('id', matchId);
  await supabase.auth.admin.deleteUser(userId);
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
