import { supabase } from '../../database/supabaseClient';
import { WC26_GROUP_NAMES, normalizeGroupId } from '../../constants/groups';
import {
  mapDbMatchToMatch,
  mapDbPlayerToPlayer,
  mapDbStandingToStanding,
  mapDbTeamToTeam,
} from '../../utils/mappers';
import {
  PLAYER_TRACE_SELECT,
  calculatePlayerDataQuality,
  fieldCoverage,
  findDuplicateNameGroups,
  playersWithoutExternalId,
  teamQualitySummary,
  topIncompletePlayers,
} from './playerDataQuality';
import { enrichPlayersBatch, enrichSinglePlayer } from './playerEnrichmentService';
import { enrichVerifiedPlayers } from './verifiedEnrichmentService';
import { linkPlayerIdentities } from './playerIdentityLinkingService';
import { fetchAllFromTable } from '../../utils/supabasePaginate';
import { ApiFootballPlayerProvider } from './providers/ApiFootballPlayerProvider';
import { SportmonksPlayerProvider } from './providers/SportmonksPlayerProvider';
import { TransfermarktPlayerProvider } from './providers/TransfermarktPlayerProvider';
import type { GroupSummary, Match, Player, Standing, Team } from '../../types/worldcup';

const TEAM_COLS =
  'id,name,code,short_name,country_code,flag_url,crest_url,group_label,fifa_ranking,coach,confederation';
const PLAYER_COLS =
  'id,team_id,name,position,detailed_position,shirt_number,date_of_birth,birth_place,nationality,market_value,market_value_eur,photo_url,club,height,weight,preferred_foot,rating,data_quality_score,data_sources,last_enriched_at,enrichment_status';
const MATCH_SELECT = `*, home_team:home_team_id(${TEAM_COLS}), away_team:away_team_id(${TEAM_COLS})`;

function asDbRow(row: unknown): Record<string, unknown> {
  return row as Record<string, unknown>;
}

export interface PlayerStats {
  playerId: string;
  goals: number;
  assists: number;
  appearances: number;
  rating: number | null;
  marketValue: number | null;
  shirtNumber?: number | null;
  height?: number | null;
  preferredFoot?: string | null;
}

async function aggregatePlayerStats(
  playerIds: string[]
): Promise<Map<string, Omit<PlayerStats, 'playerId' | 'marketValue'>>> {
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


export const footballDataService = {
  async getGroups(): Promise<GroupSummary[]> {
    const standings = await footballDataService.getStandings();
    return WC26_GROUP_NAMES.map(groupId => {
      const rows = standings
        .filter(s => normalizeGroupId(s.groupLabel) === groupId)
        .sort((a, b) => a.rank - b.rank);
      const teams = rows.map(r => r.team).filter((t): t is Team => !!t);
      return { id: groupId, label: `Grupo ${groupId}`, standings: rows, teams };
    });
  },

  async getGroupById(groupId: string): Promise<GroupSummary | null> {
    const id = normalizeGroupId(groupId);
    const groups = await footballDataService.getGroups();
    return groups.find(g => g.id === id) ?? null;
  },

  async getTeamById(id: string): Promise<Team | null> {
    const { data, error } = await supabase.from('teams').select(TEAM_COLS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapDbTeamToTeam(asDbRow(data)) : null;
  },

  async getAllPlayers(): Promise<Player[]> {
    const rows = await fetchAllFromTable<Record<string, unknown>>(supabase, 'players', `${PLAYER_COLS}, team:team_id(${TEAM_COLS})`, {
      column: 'name',
      ascending: true,
    });
    return rows.map(row => mapDbPlayerToPlayer(asDbRow(row)));
  },

  async getTeamPlayers(teamId: string): Promise<Player[]> {
    const { data, error } = await supabase
      .from('players')
      .select(`${PLAYER_COLS}, team:team_id(${TEAM_COLS})`)
      .eq('team_id', teamId)
      .order('shirt_number', { ascending: true, nullsFirst: false })
      .order('name');

    if (error) throw error;

    const players = (data ?? []).map(row => mapDbPlayerToPlayer(asDbRow(row)));
    return players;
  },

  async getPlayerById(id: string): Promise<Player | null> {
    const { data, error } = await supabase
      .from('players')
      .select(`${PLAYER_COLS}, team:team_id(${TEAM_COLS})`)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

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
  },

  async getPlayerStats(playerId: string): Promise<PlayerStats | null> {
    const player = await footballDataService.getPlayerById(playerId);
    if (!player) return null;

    const agg = await aggregatePlayerStats([playerId]);
    const stats = agg.get(playerId) ?? { goals: 0, assists: 0, appearances: 0, rating: 0 };

    return {
      playerId,
      goals: stats.goals,
      assists: stats.assists,
      appearances: stats.appearances,
      rating: player.rating ?? (stats.rating > 0 ? stats.rating : null),
      marketValue: player.marketValue,
      shirtNumber: player.shirtNumber ?? null,
      height: player.height ?? null,
      preferredFoot: player.preferredFoot ?? null,
    };
  },

  async getFixtures(filters?: { group?: string; teamId?: string; status?: string }): Promise<Match[]> {
    let q = supabase.from('matches').select(MATCH_SELECT).order('kick_off');

    if (filters?.status === 'live') {
      q = q.in('status', ['live', 'halftime']);
    } else if (filters?.status) {
      q = q.eq('status', filters.status);
    }

    const { data, error } = await q;
    if (error) throw error;

    let matches = (data ?? []).map(row => mapDbMatchToMatch(asDbRow(row)));

    if (filters?.group) {
      const groupId = normalizeGroupId(filters.group);
      matches = matches.filter(m => normalizeGroupId(m.group) === groupId);
    }

    if (filters?.teamId) {
      matches = matches.filter(m => m.homeTeamId === filters.teamId || m.awayTeamId === filters.teamId);
    }

    return matches;
  },

  async getStandings(groupLabel?: string): Promise<Standing[]> {
    let q = supabase
      .from('standings')
      .select(`*, team:team_id(${TEAM_COLS})`)
      .order('rank');

    if (groupLabel) {
      const id = normalizeGroupId(groupLabel);
      q = q.or(
        `group_label.eq.${id},group_label.eq.Group ${id},group_label.ilike.%${id}%`
      );
    }

    const { data, error } = await q;
    if (error) throw error;

    const all = (data ?? []).map(row => mapDbStandingToStanding(asDbRow(row)));
    if (!groupLabel) return all;

    const id = normalizeGroupId(groupLabel);
    return all.filter(s => normalizeGroupId(s.groupLabel) === id);
  },

  async getPlayerDataQualityReport() {
    const pageSize = 1000;
    let offset = 0;
    const players: Record<string, unknown>[] = [];

    while (true) {
      const { data, error } = await supabase.from('players').select(PLAYER_TRACE_SELECT).range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (!data?.length) break;
      players.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    const { data: teams } = await supabase.from('teams').select('id,name');
    const teamNames = new Map((teams ?? []).map(t => [t.id, t.name]));

    for (const p of players) {
      const row = p as Record<string, unknown>;
      if (!row.data_quality_score) row.data_quality_score = calculatePlayerDataQuality(row);
    }

    const coverage = fieldCoverage(players as Record<string, unknown>[]);
    const complete = players.filter(p => ((p as { data_quality_score?: number }).data_quality_score ?? 0) >= 80).length;
    const verified = players.filter(p => (p as { verification_status?: string }).verification_status === 'verified').length;
    const identityNeedsReview = players.filter(p => (p as { verification_status?: string }).verification_status === 'needs_review').length;
    const identityConflict = players.filter(p => (p as { verification_status?: string }).verification_status === 'conflict').length;
    const identityRejected = players.filter(p => (p as { verification_status?: string }).verification_status === 'rejected').length;
    const withPhoto = players.filter(p => !!(p as { photo_url?: string }).photo_url).length;
    const withClub = players.filter(p => !!(p as { club?: string }).club).length;
    const withMarketValue = players.filter(p => (p as { market_value?: number; market_value_eur?: number }).market_value != null || (p as { market_value_eur?: number }).market_value_eur != null).length;
    const withoutPhoto = players.length - withPhoto;
    const total = players.length || 1;

    return {
      total: players.length,
      complete,
      incomplete: players.length - complete,
      pending: players.filter(p => (p as { enrichment_status?: string }).enrichment_status === 'pending').length,
      needsReview: players.filter(p => (p as { enrichment_status?: string }).enrichment_status === 'needs_review').length,
      identity: {
        verified,
        verifiedPct: Math.round((verified / total) * 1000) / 10,
        needsReview: identityNeedsReview,
        conflict: identityConflict,
        rejected: identityRejected,
        photoPct: Math.round((withPhoto / total) * 1000) / 10,
        clubPct: Math.round((withClub / total) * 1000) / 10,
        marketValuePct: Math.round((withMarketValue / total) * 1000) / 10,
        withPhoto,
        withClub,
        withMarketValue,
        withoutPhoto,
      },
      coverage,
      teamProgress: teamQualitySummary(players as never[], teamNames).map(t => ({
        teamName: t.teamName,
        players: t.players,
        avgQuality: t.avgQuality,
        incomplete: t.incomplete,
      })),
      worstTeams: teamQualitySummary(players as never[], teamNames).slice(0, 12),
      topIncomplete: topIncompletePlayers(players as never[], 30),
      duplicateGroups: findDuplicateNameGroups(players as never[]).length,
      withoutExternalId: playersWithoutExternalId(players as never[]).length,
      providers: {
        apiFootball: ApiFootballPlayerProvider.isConfigured(),
        sportmonks: SportmonksPlayerProvider.isConfigured(),
        transfermarkt: TransfermarktPlayerProvider.isConfigured(),
        theSportsDb: true,
        wikimedia: true,
      },
    };
  },

  async adminEnrichPlayers(options?: { teamId?: string; onlyMissingPhotos?: boolean; onlyMissingMarketValues?: boolean; resume?: boolean; verified?: boolean; batchSize?: number }) {
    if (options?.verified || options?.onlyMissingPhotos) {
      return enrichVerifiedPlayers({
        teamId: options?.teamId,
        onlyMissingPhotos: options?.onlyMissingPhotos,
        resume: options?.resume,
        batchSize: options?.batchSize,
      });
    }
    return enrichPlayersBatch(options ?? {});
  },

  async adminEnrichPlayer(playerId: string) {
    return enrichSinglePlayer(playerId);
  },

  async adminEnrichTeam(teamId: string, options?: { onlyMissingPhotos?: boolean; verified?: boolean }) {
    if (options?.verified !== false) {
      return enrichVerifiedPlayers({ teamId, onlyMissingPhotos: options?.onlyMissingPhotos });
    }
    return enrichPlayersBatch({ teamId });
  },

  async adminLinkTeam(teamId: string, options?: { batchSize?: number }) {
    return linkPlayerIdentities({ teamId, batchSize: options?.batchSize, skipVerified: true });
  },

  async adminLinkCountry(country: string, options?: { batchSize?: number }) {
    return linkPlayerIdentities({ country, batchSize: options?.batchSize, skipVerified: true });
  },

  async adminLinkAll(options?: { batchSize?: number }) {
    return linkPlayerIdentities({ allTeams: true, batchSize: options?.batchSize, skipVerified: true });
  },
};

export default footballDataService;
