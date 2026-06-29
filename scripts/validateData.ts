import { readFileSync, existsSync } from 'node:fs';
import { syncTeamGroups } from '../src/services/sync/syncTeamGroups';
import { createNodeSupabaseClient } from './lib/supabaseNodeClient.js';

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

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('FAIL Missing Supabase credentials');
  process.exit(1);
}

const supabase = createNodeSupabaseClient(url, key);

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

async function count(table: string) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function main() {
  console.log('PRODEMUNDIAL validate:data\n');

  try {
    const teams = await count('teams');
    if (teams === 48) pass('teams = 48');
    else fail('teams = 48', `got ${teams}`);
  } catch (e) {
    fail('teams = 48', e instanceof Error ? e.message : String(e));
  }

  try {
    const players = await count('players');
    if (players > 1000) pass('players > 1000', String(players));
    else fail('players > 1000', String(players));
  } catch (e) {
    fail('players > 1000', e instanceof Error ? e.message : String(e));
  }

  try {
    const matches = await count('matches');
    if (matches > 70) pass('matches > 70', String(matches));
    else fail('matches > 70', String(matches));
  } catch (e) {
    fail('matches > 70', e instanceof Error ? e.message : String(e));
  }

  try {
    const standings = await count('standings');
    if (standings === 48) pass('standings = 48');
    else fail('standings = 48', String(standings));
  } catch (e) {
    fail('standings = 48', e instanceof Error ? e.message : String(e));
  }

  const { count: nullCount, error: tgErr } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .is('group_label', null);

  if (tgErr) fail('teams.group_label not null', tgErr.message);
  else if ((nullCount ?? 0) === 0) pass('teams.group_label not null');
  else {
    const updated = await syncTeamGroups();
    const { count: after } = await supabase.from('teams').select('*', { count: 'exact', head: true }).is('group_label', null);
    if ((after ?? 0) === 0) pass('teams.group_label not null', `${updated} equipos actualizados`);
    else fail('teams.group_label not null', `${after} equipos sin grupo`);
  }

  const { data: badPlayers } = await supabase.from('players').select('id, team_id, teams(id)').limit(500);
  const invalidPlayers = (badPlayers ?? []).filter(p => !p.teams);
  if (invalidPlayers.length === 0) pass('players.team_id valid');
  else fail('players.team_id valid', `${invalidPlayers.length} inválidos`);

  const { data: badMatches } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_team:home_team_id(id), away_team:away_team_id(id)')
    .limit(200);
  const badHome = (badMatches ?? []).filter(m => m.home_team_id && !m.home_team);
  const badAway = (badMatches ?? []).filter(m => m.away_team_id && !m.away_team);
  if (badHome.length === 0 && badAway.length === 0) pass('matches teams FK valid');
  else fail('matches teams FK valid', `home:${badHome.length} away:${badAway.length}`);

  console.log('\n--- Summary ---');
  const failed = checks.filter(c => !c.ok);
  if (failed.length === 0) {
    console.log('All checks passed.');
    process.exit(0);
  }
  console.log(`${failed.length} check(s) failed.`);
  process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
