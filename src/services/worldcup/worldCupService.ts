import { supabase } from '../../lib/supabase';
import { footballApiClient } from '../../lib/api/footballApiClient';
import { fetchAllRows } from '../../utils/supabasePaginate';

import {

  mapDbMatchToMatch,

  mapDbTeamToTeam,

  mapDbPlayerToPlayer,

  mapDbStandingToStanding,

  mapDbPredictionToPrediction,

  mapDbLeaderboardEntry,

  mapDbPlayerLiveStatus,

} from '../../utils/mappers';

import type {

  Match,

  Player,

  Team,

  TopScorer,

  Standing,

  Prediction,

  LeaderboardEntry,

  PlayerLiveStatusEntry,

  GroupSummary,

} from '../../types/worldcup';

import { WC26_GROUP_NAMES, normalizeGroupId } from '../../constants/groups';



const TEAM_COLS =

  'id,name,code,short_name,country_code,flag_url,crest_url,group_label,fifa_ranking,coach,confederation';

const PLAYER_COLS =
  'id,team_id,name,position,detailed_position,shirt_number,date_of_birth,birth_place,nationality,market_value,market_value_eur,photo_url,club,height,weight,preferred_foot,rating,goals,assists,appearances,data_quality_score,data_sources,last_enriched_at,enrichment_status,verification_status,identity_confidence_score';

const MATCH_SELECT =
  '*, home_team:home_team_id(' + TEAM_COLS + '), away_team:away_team_id(' + TEAM_COLS + ')';

function asDbRow(row: unknown): Record<string, unknown> {
  return row as Record<string, unknown>;
}

async function withFootballApi<T>(apiCall: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (!footballApiClient.isEnabled()) return fallback();
  try {
    return await apiCall();
  } catch {
    return fallback();
  }
}

function normalizeApiPlayer<T extends { photo?: string | null; photoUrl?: string | null }>(player: T): T {
  if (!player.photo && player.photoUrl) {
    return { ...player, photo: player.photoUrl };
  }
  return player;
}

export const worldCupService = {

  getTeams: async (): Promise<Team[]> =>
    withFootballApi(
      () => footballApiClient.getTeams(),
      async () => {
        const { data, error } = await supabase.from('teams').select(TEAM_COLS).order('name');
        if (error) throw error;
        return (data ?? []).map(row => mapDbTeamToTeam(asDbRow(row)));
      },
    ),



  getTeamById: async (id: string): Promise<Team | null> =>
    withFootballApi(
      () => footballApiClient.getTeamById(id),
      async () => {
        const { data, error } = await supabase.from('teams').select(TEAM_COLS).eq('id', id).single();
        if (error) throw error;
        return data ? mapDbTeamToTeam(asDbRow(data)) : null;
      }
    ),



  getPlayers: async (): Promise<Player[]> => worldCupService.getAllPlayers(),



  getAllPlayers: async (): Promise<Player[]> =>
    withFootballApi(
      async () => (await footballApiClient.getAllPlayers()).map(normalizeApiPlayer),
      async () => {
        const rows = await fetchAllRows<Record<string, unknown>>((from, to) =>
          supabase
            .from('players')
            .select(PLAYER_COLS + ', team:team_id(' + TEAM_COLS + ')')
            .order('name')
            .range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>,
        );
        return rows.map(row => mapDbPlayerToPlayer(asDbRow(row)));
      },
    ),



  getPlayerById: async (id: string): Promise<Player> =>
    withFootballApi(
      async () => normalizeApiPlayer(await footballApiClient.getPlayerById(id)),
      async () => {
        const { data, error } = await supabase
          .from('players')
          .select(PLAYER_COLS + ', team:team_id(' + TEAM_COLS + ')')
          .eq('id', id)
          .single();
        if (error) throw error;
        const player = mapDbPlayerToPlayer(asDbRow(data));
        const agg = await aggregatePlayerStats([id]);
        const stats = agg.get(id);
        if (stats) {
          player.goals = stats.goals;
          player.assists = stats.assists;
          player.appearances = stats.appearances;
          if (!player.rating && stats.rating > 0) player.rating = stats.rating;
        }
        return player;
      }
    ),



  getTeamPlayers: async (teamId: string): Promise<Player[]> =>
    withFootballApi(
      async () => (await footballApiClient.getTeamPlayers(teamId)).map(normalizeApiPlayer),
      async () => {
        const { data, error } = await supabase
          .from('players')
          .select(PLAYER_COLS + ', team:team_id(' + TEAM_COLS + ')')
          .eq('team_id', teamId)
          .order('shirt_number', { ascending: true, nullsFirst: false })
          .order('name');
        if (error) throw error;
        return (data ?? []).map(row => mapDbPlayerToPlayer(asDbRow(row)));
      }
    ),



  getPlayersByTeamIds: async (teamIds: string[]): Promise<Player[]> =>
    withFootballApi(
      async () => {
        const ids = teamIds.filter(Boolean);
        if (ids.length === 0) return [];
        const lists = await Promise.all(
          ids.map(id => footballApiClient.getTeamPlayers(id).then(players => players.map(normalizeApiPlayer))),
        );
        return lists.flat();
      },
      async () => {
        const ids = teamIds.filter(Boolean);
        if (ids.length === 0) return [];

        const rows = await fetchAllRows<Record<string, unknown>>((from, to) =>
          supabase
            .from('players')
            .select(PLAYER_COLS + ', team:team_id(' + TEAM_COLS + ')')
            .in('team_id', ids)
            .order('team_id')
            .order('shirt_number', { ascending: true, nullsFirst: false })
            .order('name')
            .range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>,
        );

        return rows.map(row => mapDbPlayerToPlayer(asDbRow(row)));
      },
    ),



  getMatches: async (): Promise<Match[]> =>
    withFootballApi(
      () => footballApiClient.getFixtures(),
      async () => {
        const { data, error } = await supabase.from('matches').select(MATCH_SELECT).order('kick_off');
        if (error) throw error;
        return (data ?? []).map(row => mapDbMatchToMatch(asDbRow(row)));
      }
    ),



  getLiveMatches: async (): Promise<Match[]> =>
    withFootballApi(
      () => footballApiClient.getFixtures({ status: 'live' }),
      async () => {
        const { data, error } = await supabase
          .from('matches')
          .select(MATCH_SELECT)
          .in('status', ['live', 'halftime'])
          .order('kick_off');
        if (error) throw error;
        return (data ?? []).map(row => mapDbMatchToMatch(asDbRow(row)));
      }
    ),



  getMatchById: async (id: string): Promise<Match> =>
    withFootballApi(
      () => footballApiClient.getFixtureById(id),
      async () => {
        const { data, error } = await supabase.from('matches').select(MATCH_SELECT).eq('id', id).single();
        if (error) throw error;
        return mapDbMatchToMatch(asDbRow(data));
      },
    ),



  getTeamMatches: async (teamId: string): Promise<Match[]> => {

    const { data, error } = await supabase

      .from('matches')

      .select(MATCH_SELECT)

      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)

      .order('kick_off');

    if (error) throw error;

    return (data ?? []).map(row => mapDbMatchToMatch(asDbRow(row)));

  },



  getStandings: async (groupLabel?: string): Promise<Standing[]> => {

    let q = supabase

      .from('standings')

      .select('*, team:team_id(' + TEAM_COLS + ')')

      .order('rank');

    if (groupLabel) q = q.or(`group_label.eq.${groupLabel},group_label.eq.Group ${normalizeGroupId(groupLabel)},group_label.ilike.%${normalizeGroupId(groupLabel)}%`);

    const { data, error } = await q;

    if (error) throw error;

    const all = (data ?? []).map(row => mapDbStandingToStanding(asDbRow(row)));

    if (!groupLabel) return all;

    const id = normalizeGroupId(groupLabel);

    return all.filter(s => normalizeGroupId(s.groupLabel) === id);

  },



  getGroupStandings: async (groupLabel: string): Promise<Standing[]> => {

    return worldCupService.getStandings(groupLabel);

  },



  getGroupsOverview: async (): Promise<GroupSummary[]> =>
    withFootballApi(
      () => footballApiClient.getGroups(),
      async () => {
        const standings = await worldCupService.getStandings();
        return WC26_GROUP_NAMES.map(groupId => {
          const rows = standings
            .filter(s => normalizeGroupId(s.groupLabel) === groupId)
            .sort((a, b) => a.rank - b.rank);
          const teams = rows.map(r => r.team).filter((t): t is Team => !!t);
          return { id: groupId, label: `Grupo ${groupId}`, standings: rows, teams };
        });
      }
    ),



  getMatchesByGroup: async (groupId: string): Promise<Match[]> =>
    withFootballApi(
      () => footballApiClient.getFixtures({ group: groupId }),
      async () => {
        const id = normalizeGroupId(groupId);
        const { data, error } = await supabase.from('matches').select(MATCH_SELECT).order('kick_off');
        if (error) throw error;
        return (data ?? [])
          .map(row => mapDbMatchToMatch(asDbRow(row)))
          .filter(m => normalizeGroupId(m.group) === id);
      }
    ),



  getTeamStanding: async (teamId: string): Promise<Standing | null> => {

    const { data, error } = await supabase

      .from('standings')

      .select('*, team:team_id(' + TEAM_COLS + ')')

      .eq('team_id', teamId)

      .maybeSingle();

    if (error) throw error;

    return data ? mapDbStandingToStanding(asDbRow(data)) : null;

  },



  getTopPlayers: async (): Promise<Player[]> => {

    const { data, error } = await supabase

      .from('players')

      .select(PLAYER_COLS + ', team:team_id(' + TEAM_COLS + ')')

      .order('market_value', { ascending: false, nullsFirst: false })

      .limit(10);

    if (error) throw error;

    return (data ?? []).map(row => mapDbPlayerToPlayer(asDbRow(row)));

  },



  getTopScorers: async (limit = 10): Promise<TopScorer[]> => {

    const { data: ratings, error } = await supabase

      .from('player_ratings')

      .select('player_id,goals,assists');

    if (error) throw error;



    const totals = new Map<string, { goals: number; assists: number }>();

    for (const r of ratings ?? []) {

      const prev = totals.get(r.player_id) ?? { goals: 0, assists: 0 };

      prev.goals += Number(r.goals ?? 0);

      prev.assists += Number(r.assists ?? 0);

      totals.set(r.player_id, prev);

    }



    const ranked = [...totals.entries()]

      .sort((a, b) => b[1].goals - a[1].goals || b[1].assists - a[1].assists)

      .slice(0, limit);



    if (ranked.length === 0) return [];



    const ids = ranked.map(([id]) => id);

    const { data: players, error: pErr } = await supabase

      .from('players')

      .select(PLAYER_COLS + ', team:team_id(' + TEAM_COLS + ')')

      .in('id', ids);

    if (pErr) throw pErr;



    const playerMap = new Map(

      (players ?? []).map((p) => [String(asDbRow(p).id), mapDbPlayerToPlayer(asDbRow(p))])

    );

    return ranked

      .map(([id, agg]) => {

        const player = playerMap.get(id);

        if (!player) return null;

        player.goals = agg.goals;

        player.assists = agg.assists;

        return { player, goals: agg.goals, assists: agg.assists };

      })

      .filter((x): x is TopScorer => x !== null);

  },



  getPredictions: async (userId: string): Promise<Prediction[]> => {

    const { data, error } = await supabase.from('predictions').select('*').eq('user_id', userId);

    if (error) throw error;

    return (data ?? []).map(row => mapDbPredictionToPrediction(asDbRow(row)));

  },



  getLeaderboard: async (): Promise<LeaderboardEntry[]> => {

    const { data, error } = await supabase

      .from('leaderboard')

      .select('user_id,rank,points,wins,draws,losses, profiles(full_name, legajo, avatar_url)')

      .order('points', { ascending: false });

    if (error) throw error;

    return (data ?? []).map(row => mapDbLeaderboardEntry(asDbRow(row)));

  },



  getMatchEvents: async (matchId: string) => {

    const { data, error } = await supabase

      .from('events')

      .select('*')

      .eq('match_id', matchId)

      .order('created_at', { ascending: true });

    if (error) throw error;

    return data ?? [];

  },



  getMatchStats: async (matchId: string) => {

    const { data, error } = await supabase

      .from('player_ratings')

      .select('goals,assists,xg,xa,yellow_cards,red_cards')

      .eq('match_id', matchId);

    if (error) return null;

    const rows = data ?? [];

    if (rows.length === 0) return null;

    return {

      goals: rows.reduce((s, r) => s + Number(r.goals ?? 0), 0),

      assists: rows.reduce((s, r) => s + Number(r.assists ?? 0), 0),

      xG: rows.reduce((s, r) => s + Number(r.xg ?? 0), 0),

      yellowCards: rows.reduce((s, r) => s + Number(r.yellow_cards ?? 0), 0),

      redCards: rows.reduce((s, r) => s + Number(r.red_cards ?? 0), 0),

    };

  },



  getPlayerLiveStatus: async (matchId: string): Promise<PlayerLiveStatusEntry[]> => {

    const { data, error } = await supabase

      .from('player_live_status')

      .select(

        '*, player:player_id(id,name,photo_url,position), team:team_id(id,name,code,flag_url,crest_url), match:match_id(id,status,kick_off)'

      )

      .eq('match_id', matchId)

      .order('is_starting', { ascending: false });

    if (error) throw error;

    return (data ?? []).map(row => mapDbPlayerLiveStatus(asDbRow(row)));

  },



  getPlayerLiveStatusForPlayer: async (playerId: string): Promise<PlayerLiveStatusEntry[]> => {

    const { data, error } = await supabase

      .from('player_live_status')

      .select(

        '*, player:player_id(id,name,photo_url,position), team:team_id(id,name,code,flag_url,crest_url), match:match_id(id,status,kick_off)'

      )

      .eq('player_id', playerId)

      .order('last_updated', { ascending: false })

      .limit(10);

    if (error) throw error;

    return (data ?? []).map(row => mapDbPlayerLiveStatus(asDbRow(row)));

  },

};



async function aggregatePlayerStats(

  playerIds: string[]

): Promise<Map<string, { goals: number; assists: number; appearances: number; rating: number }>> {

  const result = new Map<string, { goals: number; assists: number; appearances: number; rating: number }>();

  if (playerIds.length === 0) return result;



  const { data, error } = await supabase

    .from('player_ratings')

    .select('player_id,goals,assists,rating')

    .in('player_id', playerIds);

  if (error) return result;



  const acc = new Map<string, { goals: number; assists: number; appearances: number; ratingSum: number }>();

  for (const r of data ?? []) {

    const prev = acc.get(r.player_id) ?? { goals: 0, assists: 0, appearances: 0, ratingSum: 0 };

    prev.goals += Number(r.goals ?? 0);

    prev.assists += Number(r.assists ?? 0);

    prev.appearances += 1;

    prev.ratingSum += Number(r.rating ?? 0);

    acc.set(r.player_id, prev);

  }



  for (const [id, v] of acc) {

    result.set(id, {

      goals: v.goals,

      assists: v.assists,

      appearances: v.appearances,

      rating: v.appearances > 0 ? Number((v.ratingSum / v.appearances).toFixed(2)) : 0,

    });

  }

  return result;

}


