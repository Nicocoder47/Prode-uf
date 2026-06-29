import { supabase } from '../../database/supabaseClient';
import { normalizeGroupId } from '../../constants/groups';

/** Mapa team_id → grupo desde partidos de fase de grupos (fuente más confiable). */
export async function buildTeamGroupsFromMatches(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, group_label, stage')
    .eq('stage', 'group');
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const group = normalizeGroupId(row.group_label);
    if (!group) continue;
    if (row.home_team_id) map.set(row.home_team_id, group);
    if (row.away_team_id) map.set(row.away_team_id, group);
  }
  return map;
}

async function applyTeamGroupMap(map: Map<string, string>): Promise<number> {
  let updated = 0;
  const now = new Date().toISOString();
  for (const [teamId, group] of map) {
    const { error: teamErr } = await supabase
      .from('teams')
      .update({ group_label: group, updated_at: now })
      .eq('id', teamId);
    if (!teamErr) updated += 1;

    await supabase
      .from('standings')
      .update({ group_label: group, updated_at: now })
      .eq('team_id', teamId);
  }
  return updated;
}

/** Propaga group_label desde partidos de grupos hacia teams y standings. */
export async function syncTeamGroupsFromMatches(): Promise<number> {
  const map = await buildTeamGroupsFromMatches();
  return applyTeamGroupMap(map);
}

/** Propaga group_label desde standings hacia teams (fallback si no hay fixtures). */
export async function syncTeamGroupsFromStandings(): Promise<number> {
  const { data, error } = await supabase.from('standings').select('team_id, group_label');
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const group = normalizeGroupId(row.group_label);
    if (!group || !row.team_id) continue;
    map.set(row.team_id, group);
  }
  return applyTeamGroupMap(map);
}

/** Prioriza fixtures de grupos; si no hay datos, usa standings. */
export async function syncTeamGroups(): Promise<number> {
  const fromMatches = await buildTeamGroupsFromMatches();
  if (fromMatches.size >= 48) return applyTeamGroupMap(fromMatches);
  if (fromMatches.size > 0) return applyTeamGroupMap(fromMatches);
  return syncTeamGroupsFromStandings();
}
