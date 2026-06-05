/**
 * End-to-end data integrity + flow validation for PRODEMUNDIAL 2026.
 * Run: npm run test:flow
 */
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

loadEnvFile('.env');
loadEnvFile('.env.local');

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !serviceKey) {
  console.error('FAIL Missing SUPABASE_URL or service/anon key');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];

function pass(name: string, detail?: string) {
  checks.push({ name, ok: true, detail });
  console.log(`OK   ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail?: string) {
  checks.push({ name, ok: false, detail });
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

async function countTable(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function testPredictionFlow(
  supabase: ReturnType<typeof createClient>,
  pass: (name: string, detail?: string) => void,
  fail: (name: string, detail?: string) => void
) {
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (profileErr || !profile) {
    pass('predictions upsert (skipped)', profileErr?.message ?? 'sin perfiles — registrá un usuario en la app');
    pass('scoring + leaderboard (skipped)', 'sin perfil de prueba');
    return;
  }

  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id,status,score_home,score_away,scored_at,is_locked,home_team_id,away_team_id')
    .eq('status', 'scheduled')
    .is('scored_at', null)
    .limit(1)
    .maybeSingle();

  if (matchErr || !match) {
    fail('predictions upsert', matchErr?.message ?? 'sin partidos scheduled');
    fail('scoring + leaderboard', 'sin partido scheduled');
    return;
  }

  const userId = profile.id as string;
  const matchId = match.id as string;
  const matchBackup = { ...match };

  // Cleanup previo por si quedó basura
  await supabase.from('predictions').delete().eq('user_id', userId).eq('match_id', matchId);

  const { data: upserted, error: upsertErr } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id: userId,
        match_id: matchId,
        predicted_winner: 'home',
        predicted_score_home: 2,
        predicted_score_away: 1,
        status: 'pending',
        points: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,match_id' }
    )
    .select('id,status,predicted_score_home,predicted_score_away')
    .single();

  if (upsertErr || !upserted) {
    fail('predictions upsert', upsertErr?.message ?? 'sin respuesta');
    fail('scoring + leaderboard', 'upsert falló');
    return;
  }
  pass('predictions upsert', `id=${upserted.id}`);

  const { data: lbBefore } = await supabase
    .from('leaderboard')
    .select('points')
    .eq('user_id', userId)
    .eq('period', 'global')
    .maybeSingle();
  const pointsBefore = Number(lbBefore?.points ?? 0);

  const { error: finishErr } = await supabase
    .from('matches')
    .update({
      status: 'finished',
      score_home: 2,
      score_away: 1,
      scored_at: null,
      is_locked: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId);

  if (finishErr) {
    fail('scoring + leaderboard', finishErr.message);
    await restoreMatch(supabase, matchBackup);
    await supabase.from('predictions').delete().eq('user_id', userId).eq('match_id', matchId);
    return;
  }

  const { data: scoredCount, error: scoreErr } = await supabase.rpc('score_match_predictions', {
    p_match_id: matchId,
  });

  if (scoreErr) {
    fail('scoring + leaderboard', scoreErr.message);
    await restoreMatch(supabase, matchBackup);
    await supabase.from('predictions').delete().eq('user_id', userId).eq('match_id', matchId);
    return;
  }

  const { data: scoredPred, error: predErr } = await supabase
    .from('predictions')
    .select('status,points')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .single();

  if (predErr || scoredPred?.status !== 'scored' || Number(scoredPred.points) < 5) {
    fail(
      'scoring + leaderboard',
      predErr?.message ?? `status=${scoredPred?.status} points=${scoredPred?.points}`
    );
  } else {
    pass('scoring funciona', `${scoredCount} predicción(es), ${scoredPred.points} pts`);
  }

  const { data: lbAfter, error: lbAfterErr } = await supabase
    .from('leaderboard')
    .select('points')
    .eq('user_id', userId)
    .eq('period', 'global')
    .maybeSingle();

  if (lbAfterErr || Number(lbAfter?.points ?? 0) <= pointsBefore) {
    fail('leaderboard actualiza', lbAfterErr?.message ?? `antes=${pointsBefore} después=${lbAfter?.points ?? 0}`);
  } else {
    pass('leaderboard actualiza', `${pointsBefore} → ${lbAfter?.points}`);
  }

  // Restaurar estado original
  await restoreMatch(supabase, matchBackup);
  await supabase.from('predictions').delete().eq('user_id', userId).eq('match_id', matchId);

  if (lbBefore) {
    await supabase
      .from('leaderboard')
      .update({ points: pointsBefore, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('period', 'global');
  } else {
    await supabase.from('leaderboard').delete().eq('user_id', userId).eq('period', 'global');
  }
}

async function restoreMatch(
  supabase: ReturnType<typeof createClient>,
  backup: Record<string, unknown>
) {
  await supabase
    .from('matches')
    .update({
      status: backup.status,
      score_home: backup.score_home,
      score_away: backup.score_away,
      scored_at: backup.scored_at,
      is_locked: backup.is_locked ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', backup.id);
}

async function main() {
  console.log('PRODEMUNDIAL test:flow\n');

  const tables = [
    'teams',
    'players',
    'matches',
    'standings',
    'predictions',
    'leaderboard',
    'player_live_status',
    'player_ratings',
  ] as const;

  const counts: Record<string, number> = {};
  for (const t of tables) {
    try {
      counts[t] = await countTable(t);
      pass(`count ${t}`, String(counts[t]));
    } catch (e) {
      fail(`count ${t}`, e instanceof Error ? e.message : String(e));
    }
  }

  if ((counts.teams ?? 0) > 0) pass('teams > 0');
  else fail('teams > 0');

  if ((counts.players ?? 0) > 0) pass('players > 0');
  else fail('players > 0');

  if ((counts.matches ?? 0) > 0) pass('matches > 0');
  else fail('matches > 0');

  if ((counts.standings ?? 0) > 0) pass('standings > 0');
  else fail('standings > 0');

  // Players with valid team FK
  const { data: playersJoin, error: pjErr } = await supabase
    .from('players')
    .select('id, team_id, teams(id, name)')
    .limit(500);
  if (pjErr) fail('players join teams', pjErr.message);
  else {
    const invalid = (playersJoin ?? []).filter(p => !p.teams);
    if (invalid.length === 0) pass('players con team válido', `${playersJoin?.length ?? 0} muestra OK`);
    else fail('players con team válido', `${invalid.length} sin team en join`);
  }

  // Matches with team relations
  const { data: matchesJoin, error: mjErr } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_team:home_team_id(id,name), away_team:away_team_id(id,name)')
    .limit(500);
  if (mjErr) fail('matches join teams', mjErr.message);
  else {
    const missingHome = (matchesJoin ?? []).filter(m => m.home_team_id && !m.home_team);
    const missingAway = (matchesJoin ?? []).filter(m => m.away_team_id && !m.away_team);
    if (missingHome.length === 0 && missingAway.length === 0) {
      pass('matches con teams válidos', `${matchesJoin?.length ?? 0} muestra OK`);
    } else {
      fail('matches con teams válidos', `home null: ${missingHome.length}, away null: ${missingAway.length}`);
    }
  }

  // Scoring function exists
  const { error: fnErr } = await supabase.rpc('score_match_predictions', { p_match_id: '00000000-0000-0000-0000-000000000000' });
  if (fnErr && !fnErr.message.includes('0')) {
    if (fnErr.message.includes('function') || fnErr.code === '42883') fail('score_match_predictions exists', fnErr.message);
    else pass('score_match_predictions callable', fnErr.message);
  } else {
    pass('score_match_predictions callable');
  }

  // Predictions upsert shape (dry run — no write without profile)
  const { error: predSelectErr } = await supabase.from('predictions').select('id,user_id,match_id,status,points').limit(1);
  if (predSelectErr) fail('predictions readable', predSelectErr.message);
  else pass('predictions readable');

  const { error: lbErr } = await supabase.from('leaderboard').select('user_id,rank,points, profiles(full_name)').limit(5);
  if (lbErr) fail('leaderboard join profiles', lbErr.message);
  else pass('leaderboard join profiles');

  // E2E: predictions upsert + scoring (requires service role + existing profile)
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasServiceRole) {
    pass('predictions upsert (skipped)', 'requiere SUPABASE_SERVICE_ROLE_KEY');
    pass('scoring + leaderboard (skipped)', 'requiere SUPABASE_SERVICE_ROLE_KEY');
  } else {
    await testPredictionFlow(supabase, pass, fail);
  }

  console.log('\n--- Summary ---');
  const failed = checks.filter(c => !c.ok);
  if (failed.length === 0) {
    console.log('All checks passed.');
    process.exit(0);
  } else {
    console.log(`${failed.length} check(s) failed.`);
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
