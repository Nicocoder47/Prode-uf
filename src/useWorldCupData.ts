import { useCallback } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Match, Team, Player, Prediction, TopScorer, Standing, LeaderboardEntry, PlayerLiveStatusEntry } from './types/worldcup';

import { worldCupService } from './services/worldcup/worldCupService';
import { footballApiClient } from './lib/api/footballApiClient';

import { ENABLE_LIVE_INSIGHTS, ENABLE_REALTIME, BETA_POLL_INTERVAL_MS } from './config/betaMode';
import { useBetaQuerySync } from './hooks/useBetaQuerySync';



export const worldCupKeys = {

  all: ['worldcup'] as const,

  matches: () => [...worldCupKeys.all, 'matches'] as const,

  liveMatches: () => [...worldCupKeys.matches(), 'live'] as const,

  match: (id: string) => [...worldCupKeys.matches(), id] as const,

  teamMatches: (id: string) => [...worldCupKeys.team(id), 'matches'] as const,

  teams: () => [...worldCupKeys.all, 'teams'] as const,

  team: (id: string) => [...worldCupKeys.teams(), id] as const,

  teamPlayers: (id: string) => [...worldCupKeys.team(id), 'players'] as const,

  matchPlayers: (homeId: string, awayId: string) => [...worldCupKeys.all, 'match-players', homeId, awayId] as const,

  players: () => [...worldCupKeys.all, 'players'] as const,

  player: (id: string) => [...worldCupKeys.players(), id] as const,

  playerLiveForPlayer: (id: string) => [...worldCupKeys.player(id), 'live'] as const,

  leaderboard: () => [...worldCupKeys.all, 'leaderboard'] as const,

  predictions: (userId: string) => [...worldCupKeys.all, 'predictions', userId] as const,

  topPlayers: () => [...worldCupKeys.players(), 'top'] as const,

  topScorers: () => [...worldCupKeys.players(), 'scorers'] as const,

  playerLiveStatus: (matchId: string) => [...worldCupKeys.match(matchId), 'live-status'] as const,

  standings: (group?: string) => [...worldCupKeys.all, 'standings', group ?? 'all'] as const,

  groups: () => [...worldCupKeys.all, 'groups'] as const,

  group: (id: string) => [...worldCupKeys.groups(), id] as const,

  groupMatches: (id: string) => [...worldCupKeys.group(id), 'matches'] as const,

  playerStats: (id: string) => [...worldCupKeys.player(id), 'stats'] as const,

};



export type { LeaderboardEntry };



export const useWorldCupTeams = () => {

  return useQuery<Team[]>({

    queryKey: worldCupKeys.teams(),

    queryFn: worldCupService.getTeams,

    staleTime: 1000 * 60 * 60 * 24,

  });

};



export const useWorldCupTeam = (teamId?: string) => {

  return useQuery<Team | null>({

    queryKey: worldCupKeys.team(teamId ?? ''),

    enabled: !!teamId,

    queryFn: () => worldCupService.getTeamById(teamId!),

  });

};



export const useTeamPlayers = (teamId?: string) => {

  return useQuery<Player[]>({

    queryKey: worldCupKeys.teamPlayers(teamId ?? ''),

    enabled: !!teamId,

    queryFn: () => worldCupService.getTeamPlayers(teamId!),

    staleTime: 1000 * 60 * 30,

    retry: 1,

  });

};



export const useTeamMatches = (teamId?: string) => {

  return useQuery<Match[]>({

    queryKey: worldCupKeys.teamMatches(teamId ?? ''),

    enabled: !!teamId,

    queryFn: () => worldCupService.getTeamMatches(teamId!),

  });

};



export const useMatchPlayers = (homeTeamId?: string, awayTeamId?: string) => {

  return useQuery<Player[]>({

    queryKey: worldCupKeys.matchPlayers(homeTeamId ?? '', awayTeamId ?? ''),

    enabled: !!homeTeamId && !!awayTeamId,

    queryFn: () => worldCupService.getPlayersByTeamIds([homeTeamId!, awayTeamId!]),

    staleTime: 1000 * 60 * 30,

  });

};



export const useWorldCupMatches = () => {

  return useQuery<Match[]>({

    queryKey: worldCupKeys.matches(),

    queryFn: worldCupService.getMatches,

    staleTime: ENABLE_LIVE_INSIGHTS ? 90_000 : 1000 * 60 * 60,

    refetchInterval: ENABLE_REALTIME
      ? false
      : ENABLE_LIVE_INSIGHTS
        ? 45_000
        : BETA_POLL_INTERVAL_MS.matches,

  });

};



export const useWorldCupMatch = (matchId?: string) => {

  return useQuery<Match>({

    queryKey: worldCupKeys.match(matchId ?? ''),

    enabled: !!matchId,

    queryFn: () => worldCupService.getMatchById(matchId!),

  });

};



export const useLiveMatches = () => {

  const queryClient = useQueryClient();

  const invalidateLive = useCallback(() => {

    queryClient.invalidateQueries({ queryKey: worldCupKeys.liveMatches() });

  }, [queryClient]);

  const pollMs = useBetaQuerySync(
    true,
    'matches',
    invalidateLive,
    [invalidateLive],
    { pollMs: BETA_POLL_INTERVAL_MS.liveMatches },
  );

  return useQuery<Match[]>({

    queryKey: worldCupKeys.liveMatches(),

    queryFn: worldCupService.getLiveMatches,

    staleTime: 1000 * 15,

    refetchInterval: pollMs || false,

  });

};



export const useLeaderboard = () => {

  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {

    queryClient.invalidateQueries({ queryKey: worldCupKeys.leaderboard() });

  }, [queryClient]);

  const pollMs = useBetaQuerySync(
    true,
    'leaderboard',
    invalidate,
    [invalidate],
    { pollMs: BETA_POLL_INTERVAL_MS.leaderboard },
  );

  return useQuery<LeaderboardEntry[]>({

    queryKey: worldCupKeys.leaderboard(),

    queryFn: worldCupService.getLeaderboard,

    refetchInterval: pollMs || false,

  });

};



export const usePredictions = (userId?: string) => {

  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {

    if (userId) {

      queryClient.invalidateQueries({ queryKey: worldCupKeys.predictions(userId) });

    }

  }, [queryClient, userId]);



  const pollMs = useBetaQuerySync(

    !!userId,

    'predictions',

    invalidate,

    [invalidate, userId],

    {
      filter: userId ? `user_id=eq.${userId}` : undefined,
      pollMs: BETA_POLL_INTERVAL_MS.predictions,
    },

  );

  return useQuery<Prediction[]>({

    queryKey: worldCupKeys.predictions(userId ?? ''),

    enabled: !!userId,

    queryFn: () => worldCupService.getPredictions(userId!),

    refetchInterval: pollMs || false,

  });

};



export const usePlayer = (playerId?: string) => {

  return useQuery<Player>({

    queryKey: worldCupKeys.player(playerId ?? ''),

    enabled: !!playerId,

    queryFn: () => worldCupService.getPlayerById(playerId!),

  });

};



export const useAllPlayers = () => {

  return useQuery<Player[]>({

    queryKey: worldCupKeys.players(),

    queryFn: worldCupService.getAllPlayers,

    staleTime: ENABLE_LIVE_INSIGHTS ? 120_000 : 1000 * 60 * 30,

    refetchInterval: ENABLE_LIVE_INSIGHTS ? 120_000 : false,

  });

};



export const useWorldCupPlayers = useAllPlayers;



export const useTopPlayers = (limit = 20) => {

  return useQuery<Player[]>({

    queryKey: [...worldCupKeys.topPlayers(), limit],

    queryFn: () => worldCupService.getTopPlayers(limit),

    staleTime: 1000 * 60 * 60,

  });

};



export const useTopScorers = () => {

  return useQuery<TopScorer[]>({

    queryKey: worldCupKeys.topScorers(),

    queryFn: () => worldCupService.getTopScorers(10),

    staleTime: ENABLE_LIVE_INSIGHTS ? 120_000 : 1000 * 60 * 30,

    refetchInterval: ENABLE_LIVE_INSIGHTS ? 120_000 : false,

  });

};



export const useMatchEvents = (matchId?: string) => {

  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {

    if (matchId) {

      queryClient.invalidateQueries({ queryKey: [...worldCupKeys.match(matchId), 'events'] });

    }

  }, [queryClient, matchId]);



  const pollMs = useBetaQuerySync(

    !!matchId,

    'events',

    invalidate,

    [invalidate, matchId],

    {
      filter: matchId ? `match_id=eq.${matchId}` : undefined,
      pollMs: BETA_POLL_INTERVAL_MS.matchEvents,
    },

  );

  return useQuery({

    queryKey: [...worldCupKeys.match(matchId ?? ''), 'events'],

    enabled: !!matchId,

    queryFn: () => worldCupService.getMatchEvents(matchId!),

    refetchInterval: pollMs || false,

  });

};



export const useMatchStats = (matchId?: string) => {

  return useQuery({

    queryKey: [...worldCupKeys.match(matchId ?? ''), 'stats'],

    enabled: !!matchId,

    queryFn: () => worldCupService.getMatchStats(matchId!),

  });

};



export const usePlayerLiveStatus = (matchId?: string) => {

  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {

    if (matchId) {

      queryClient.invalidateQueries({ queryKey: worldCupKeys.playerLiveStatus(matchId) });

    }

  }, [queryClient, matchId]);



  const pollMs = useBetaQuerySync(

    !!matchId,

    'player_live_status',

    invalidate,

    [invalidate, matchId],

    {
      filter: matchId ? `match_id=eq.${matchId}` : undefined,
      pollMs: BETA_POLL_INTERVAL_MS.playerLiveStatus,
    },

  );

  return useQuery<PlayerLiveStatusEntry[]>({

    queryKey: worldCupKeys.playerLiveStatus(matchId ?? ''),

    enabled: !!matchId,

    queryFn: () => worldCupService.getPlayerLiveStatus(matchId!),

    staleTime: 1000 * 15,

    refetchInterval: pollMs || false,

  });

};



export const usePlayerLiveStatusForPlayer = (playerId?: string) => {

  return useQuery<PlayerLiveStatusEntry[]>({

    queryKey: worldCupKeys.playerLiveForPlayer(playerId ?? ''),

    enabled: !!playerId,

    queryFn: () => worldCupService.getPlayerLiveStatusForPlayer(playerId!),

    staleTime: 1000 * 15,

  });

};



export const useStandings = (groupLabel?: string) => {

  return useQuery<Standing[]>({

    queryKey: worldCupKeys.standings(groupLabel),

    queryFn: () => worldCupService.getStandings(groupLabel),

    staleTime: 1000 * 60 * 30,

  });

};



export const useGroupsOverview = () => {

  return useQuery({

    queryKey: worldCupKeys.groups(),

    queryFn: worldCupService.getGroupsOverview,

    staleTime: 1000 * 60 * 30,

  });

};



export const useGroupMatches = (groupId?: string) => {

  return useQuery({

    queryKey: worldCupKeys.groupMatches(groupId ?? ''),

    enabled: !!groupId,

    queryFn: () => worldCupService.getMatchesByGroup(groupId!),

  });

};



export const usePlayerStats = (playerId?: string) => {
  return useQuery({
    queryKey: worldCupKeys.playerStats(playerId ?? ''),
    enabled: !!playerId && footballApiClient.isEnabled(),
    queryFn: () => footballApiClient.getPlayerStats(playerId!),
    staleTime: 1000 * 60 * 15,
  });
};

export const useTeamStanding = (teamId?: string) => {

  return useQuery({

    queryKey: [...worldCupKeys.team(teamId ?? ''), 'standing'],

    enabled: !!teamId,

    queryFn: () => worldCupService.getTeamStanding(teamId!),

  });

};



