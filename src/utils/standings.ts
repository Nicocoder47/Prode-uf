import type { GroupTeamStats, Match, Team } from '../types/worldcup';
import { WC26_GROUP_NAMES } from '../constants/groups';

const GROUPS = WC26_GROUP_NAMES;

function emptyStats(team: Team): GroupTeamStats {
  return {
    teamId: team.id,
    team,
    position: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

/** Calcula standings reales desde partidos finalizados de fase de grupos. */
export function computeGroupStandings(teams: Team[], matches: Match[]): GroupTeamStats[][] {
  const byGroup = new Map<string, Map<string, GroupTeamStats>>();

  for (const group of GROUPS) {
    const groupTeams = teams.filter(t => (t.group || '').toUpperCase() === group);
    const map = new Map<string, GroupTeamStats>();
    for (const t of groupTeams) map.set(t.id, emptyStats(t));
    byGroup.set(group, map);
  }

  const finished = matches.filter(
    m => m.status === 'finished'
      && m.stage === 'group'
      && m.homeScore !== null
      && m.awayScore !== null
  );

  for (const m of finished) {
    const groupKey = (m.group || '').toUpperCase();
    const map = byGroup.get(groupKey);
    if (!map) continue;

    const home = map.get(m.homeTeamId);
    const away = map.get(m.awayTeamId);
    if (!home || !away) continue;

    const hs = m.homeScore!;
    const as = m.awayScore!;

    home.played += 1;
    away.played += 1;
    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;

    if (hs > as) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (hs < as) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return GROUPS.map(group => {
    const map = byGroup.get(group)!;
    const rows = [...map.values()].map(row => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
    }));
    rows.sort((a, b) =>
      b.points - a.points
      || b.goalDifference - a.goalDifference
      || b.goalsFor - a.goalsFor
    );
    return rows.map((row, i) => ({ ...row, position: i + 1 }));
  });
}
