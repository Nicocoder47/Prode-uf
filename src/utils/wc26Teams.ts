import { TBD_TEAM_ID } from '../constants/knockoutBracket';
import { WC26_PARTICIPANT_SET } from '../constants/wc26Participants';
import { normalizeGroupId } from '../constants/groups';
import type { Match, Standing, Team } from '../types/worldcup';

type TeamLike = { id?: string; code?: string | null; name?: string | null };

/** Placeholder de bracket (no es una selección real). */
export function isPlaceholderTeam(team: TeamLike): boolean {
  if (team.id === TBD_TEAM_ID) return true;
  const code = (team.code ?? '').trim().toUpperCase();
  if (code === 'TBD' || code === 'TBD_SYS') return true;
  const name = (team.name ?? '').toLowerCase();
  return name.includes('por definir') || name === 'tbd';
}

export function isWc26Participant(team: TeamLike): boolean {
  const code = (team.code ?? '').trim().toUpperCase();
  return code.length > 0 && WC26_PARTICIPANT_SET.has(code);
}

/** Solo las 48 selecciones del Mundial 2026 (sin TBD ni reservas). */
export function filterWc26Teams<T extends TeamLike>(teams: T[]): T[] {
  return teams.filter(t => !isPlaceholderTeam(t) && isWc26Participant(t));
}

/**
 * Grupo canónico por equipo: partidos de fase de grupos > standings > teams.group_label.
 */
export function buildTeamGroupMap(
  standings: Pick<Standing, 'teamId' | 'groupLabel'>[],
  matches: Pick<Match, 'stage' | 'group' | 'homeTeamId' | 'awayTeamId'>[],
  teams: Pick<Team, 'id' | 'group'>[] = [],
): Map<string, string> {
  const map = new Map<string, string>();

  for (const t of teams) {
    const g = normalizeGroupId(t.group);
    if (g) map.set(t.id, g);
  }

  for (const s of standings) {
    if (!s.teamId) continue;
    const g = normalizeGroupId(s.groupLabel);
    if (g) map.set(s.teamId, g);
  }

  for (const m of matches) {
    if (m.stage !== 'group') continue;
    const g = normalizeGroupId(m.group);
    if (!g) continue;
    if (m.homeTeamId) map.set(m.homeTeamId, g);
    if (m.awayTeamId) map.set(m.awayTeamId, g);
  }

  return map;
}
