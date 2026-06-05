import { useMemo } from 'react';
import {
  buildMatchIntelligence,
  buildPlayerIntelligence,
  buildTeamCompareSnapshot,
  buildTeamIntelligence,
} from '../utils/intelligenceAnalytics';
import { computeAverageAge, computeSquadValue } from '../utils/teamAnalytics';
import {
  usePlayer,
  usePlayerStats,
  useTeamMatches,
  useTeamPlayers,
  useWorldCupMatch,
  useWorldCupMatches,
  useWorldCupTeam,
} from '../useWorldCupData';

export function useTeamIntelligence(teamId?: string) {
  const { data: team, isLoading, isError } = useWorldCupTeam(teamId);
  const { data: matches = [] } = useTeamMatches(teamId);

  const intelligence = useMemo(
    () => (team ? buildTeamIntelligence(team, matches) : null),
    [team, matches],
  );

  return { intelligence, team, matches, isLoading, isError };
}

export function usePlayerIntelligence(playerId?: string) {
  const { data: player, isLoading, isError } = usePlayer(playerId);
  const { data: stats } = usePlayerStats(playerId);
  const { data: teamMatches = [] } = useTeamMatches(player?.teamId);

  const intelligence = useMemo(() => {
    if (!player) return null;
    const s = {
      appearances: stats?.appearances ?? player.appearances ?? 0,
      goals: stats?.goals ?? player.goals ?? 0,
      assists: stats?.assists ?? player.assists ?? 0,
      rating: stats?.rating ?? player.rating ?? null,
    };
    return buildPlayerIntelligence(player, s, teamMatches);
  }, [player, stats, teamMatches]);

  return { intelligence, player, isLoading, isError };
}

export function useMatchIntelligence(matchId?: string) {
  const { data: match, isLoading, isError } = useWorldCupMatch(matchId);
  const { data: allMatches = [] } = useWorldCupMatches();

  const intelligence = useMemo(
    () => (match ? buildMatchIntelligence(match, allMatches) : null),
    [match, allMatches],
  );

  return { intelligence, match, isLoading, isError };
}

export function useTeamCompare(teamId?: string) {
  const { data: team } = useWorldCupTeam(teamId);
  const { data: matches = [] } = useTeamMatches(teamId);
  const { data: players = [] } = useTeamPlayers(teamId);

  return useMemo(() => {
    if (!team) return null;
    return buildTeamCompareSnapshot(
      team,
      matches,
      computeSquadValue(players),
      computeAverageAge(players),
    );
  }, [team, matches, players]);
}
