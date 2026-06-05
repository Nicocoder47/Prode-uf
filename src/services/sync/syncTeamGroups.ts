import { supabase } from '../../database/supabaseClient';
import { normalizeGroupId } from '../../constants/groups';

/** Propaga group_label desde standings hacia teams. */
export async function syncTeamGroupsFromStandings(): Promise<number> {
  const { data, error } = await supabase.from('standings').select('team_id, group_label');
  if (error) throw error;

  let updated = 0;
  for (const row of data ?? []) {
    const group = normalizeGroupId(row.group_label);
    if (!group || !row.team_id) continue;
    const { error: upErr } = await supabase
      .from('teams')
      .update({ group_label: group, updated_at: new Date().toISOString() })
      .eq('id', row.team_id);
    if (!upErr) updated += 1;
  }
  return updated;
}
