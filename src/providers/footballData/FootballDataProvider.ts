import axios, { type AxiosError } from 'axios';
import { supabase } from '../../database/supabaseClient';
import { TBD_TEAM_ID } from '../../constants/knockoutBracket';
import { todayInArgentina } from '../../utils/matchDay';
import {
  FOOTBALL_DATA_PROVIDER,
  normalizeFootballDataMatch,
  normalizeFootballDataPlayer,
  normalizeFootballDataStanding,
  normalizeFootballDataTeam,
  type DbMatchRow,
  type DbPlayerRow,
  type DbStandingRow,
  type DbTeamRow,
} from './normalizers';

const DEFAULT_BASE = 'https://api.football-data.org/v4';

function config() {
  return {
    baseUrl: process.env.FOOTBALL_DATA_BASE_URL || DEFAULT_BASE,
    wcCode: process.env.FOOTBALL_DATA_WORLD_CUP_CODE || 'WC',
    season: process.env.FOOTBALL_DATA_SEASON ? Number(process.env.FOOTBALL_DATA_SEASON) : 2026,
    apiKey: process.env.FOOTBALL_DATA_API_KEY || '',
  };
}

async function getTeamUuidMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('teams')
    .select('id,provider_team_id')
    .eq('provider', FOOTBALL_DATA_PROVIDER);
  if (error) {
    console.warn('[FootballData] team map error:', error.message);
    return new Map();
  }
  return new Map((data ?? []).map((t) => [String(t.provider_team_id), t.id]));
}

export class FootballDataHttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter?: string
  ) {
    super(message);
  }
}

async function footballDataGet<T = unknown>(path: string): Promise<{ data: T; status: number }> {
  const { baseUrl, apiKey } = config();
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_API_KEY not configured');
  }

  try {
    const res = await axios.get<T>(`${baseUrl}${path}`, {
      headers: { 'X-Auth-Token': apiKey },
      validateStatus: () => true,
    });

    if (res.status === 429) {
      const retryAfter = res.headers['x-request-counter'] ?? res.headers['retry-after'] ?? 'unknown';
      throw new FootballDataHttpError('Rate limit detected.', 429, String(retryAfter));
    }

    if (res.status >= 400) {
      throw new FootballDataHttpError(
        `HTTP ${res.status}: ${JSON.stringify(res.data)}`,
        res.status
      );
    }

    return { data: res.data, status: res.status };
  } catch (err) {
    if (err instanceof FootballDataHttpError) throw err;
    const ax = err as AxiosError;
    throw new FootballDataHttpError(ax.message, ax.response?.status ?? 500);
  }
}

export class FootballDataProvider {
  static isConfigured(): boolean {
    return !!process.env.FOOTBALL_DATA_API_KEY;
  }

  static getCompetitionPath(): string {
    return `/competitions/${config().wcCode}`;
  }

  static async fetchCompetitions() {
    return footballDataGet('/competitions');
  }

  static async fetchWorldCup() {
    return footballDataGet(this.getCompetitionPath());
  }

  static async fetchTeamsRaw() {
    return footballDataGet<{ teams?: Record<string, unknown>[] }>(
      `${this.getCompetitionPath()}/teams`
    );
  }

  static async fetchMatchesRaw(status?: string) {
    const q = status ? `?status=${status}` : '';
    return footballDataGet<{ matches?: Record<string, unknown>[] }>(
      `${this.getCompetitionPath()}/matches${q}`
    );
  }

  static async fetchStandingsRaw() {
    return footballDataGet<{ standings?: Record<string, unknown>[] }>(
      `${this.getCompetitionPath()}/standings`
    );
  }

  static async syncTeams(): Promise<DbTeamRow[]> {
    const { data } = await this.fetchTeamsRaw();
    const teams = (data as { teams?: Record<string, unknown>[] }).teams ?? [];
    return teams.map((t) => normalizeFootballDataTeam(t));
  }

  static async syncPlayers(): Promise<{ players: DbPlayerRow[]; squadsAvailable: boolean }> {
    const { data } = await this.fetchTeamsRaw();
    const teams = (data as { teams?: Record<string, unknown>[] }).teams ?? [];
    const teamMap = await getTeamUuidMap();

    const players: DbPlayerRow[] = [];
    let squadsAvailable = false;

    for (const team of teams) {
      const squad = (team.squad as Record<string, unknown>[] | undefined) ?? [];
      if (squad.length > 0) squadsAvailable = true;
      const teamUuid = teamMap.get(String(team.id));
      if (!teamUuid) continue;
      for (const p of squad) {
        players.push(normalizeFootballDataPlayer(p, teamUuid));
      }
    }

    return { players, squadsAvailable };
  }

  static async syncFixtures(): Promise<DbMatchRow[]> {
    const { data } = await this.fetchMatchesRaw();
    const teamMap = await getTeamUuidMap();
    const matches = (data as { matches?: Record<string, unknown>[] }).matches ?? [];
    return matches
      .map((m) => normalizeFootballDataMatch(m, teamMap, TBD_TEAM_ID))
      .filter((m): m is DbMatchRow => m !== null);
  }

  static async syncStandings(): Promise<DbStandingRow[]> {
    const { data } = await this.fetchStandingsRaw();
    const teamMap = await getTeamUuidMap();
    const { wcCode, season } = config();
    const standings = (data as { standings?: Record<string, unknown>[] }).standings ?? [];
    const rows: DbStandingRow[] = [];

    for (const block of standings) {
      const groupRaw = block.group as string | undefined;
      const groupLabel = groupRaw?.match(/GROUP_?([A-L])/i)?.[1]?.toUpperCase() ?? groupRaw ?? null;
      const table = (block.table as Record<string, unknown>[]) ?? [];
      for (const row of table) {
        const teamId = (row.team as { id?: number })?.id;
        if (teamId == null) continue;
        const teamUuid = teamMap.get(String(teamId));
        if (!teamUuid) continue;
        rows.push(
          normalizeFootballDataStanding(row, teamUuid, groupLabel, wcCode, season)
        );
      }
    }
    return rows;
  }

  static async syncTodayMatchResults(): Promise<DbMatchRow[]> {
    const day = todayInArgentina();
    const path = `${this.getCompetitionPath()}/matches?dateFrom=${day}&dateTo=${day}`;
    const { data } = await footballDataGet<{ matches?: Record<string, unknown>[] }>(path);
    const teamMap = await getTeamUuidMap();
    const matches = (data as { matches?: Record<string, unknown>[] }).matches ?? [];

    console.log(
      `[SYNC:today_results] football-data day=${day} fetched=${matches.length} teams_mapped=${teamMap.size}`,
    );

    const rows: DbMatchRow[] = [];
    for (const raw of matches) {
      const home = raw.homeTeam as { id?: number; name?: string } | undefined;
      const away = raw.awayTeam as { id?: number; name?: string } | undefined;
      const providerMatchId = String(raw.id ?? '');
      const externalStatus = String(raw.status ?? 'SCHEDULED');
      const score = raw.score as {
        fullTime?: { home?: number | null; away?: number | null };
        halfTime?: { home?: number | null; away?: number | null };
      } | undefined;

      const normalized = normalizeFootballDataMatch(raw, teamMap, TBD_TEAM_ID);
      if (!normalized) {
        const homeMapped = home?.id != null ? teamMap.has(String(home.id)) : false;
        const awayMapped = away?.id != null ? teamMap.has(String(away.id)) : false;
        console.warn(
          `[SYNC:match] SKIP provider_match_id=${providerMatchId} ${home?.name ?? '?'} vs ${away?.name ?? '?'} reason=team_map_miss home_api=${home?.id ?? 'null'} mapped=${homeMapped} away_api=${away?.id ?? 'null'} mapped=${awayMapped}`,
        );
        continue;
      }

      console.log(
        `[SYNC:match] FOUND provider_match_id=${providerMatchId} status=${externalStatus} score=${score?.fullTime?.home ?? 'null'}-${score?.fullTime?.away ?? 'null'} mapped_status=${normalized.status} mapped_score=${normalized.score_home ?? 'null'}-${normalized.score_away ?? 'null'}`,
      );
      rows.push(normalized);
    }

    return rows;
  }

  static async syncLiveMatches(): Promise<DbMatchRow[]> {
    let matches: Record<string, unknown>[] = [];

    try {
      const live = await this.fetchMatchesRaw('LIVE');
      matches = (live.data as { matches?: Record<string, unknown>[] }).matches ?? [];
    } catch {
      // fallback: filter IN_PLAY from all matches
      const all = await this.fetchMatchesRaw();
      matches =
        (all.data as { matches?: Record<string, unknown>[] }).matches?.filter(
          (m) => m.status === 'IN_PLAY' || m.status === 'PAUSED'
        ) ?? [];
    }

    const teamMap = await getTeamUuidMap();
    return matches
      .map((m) => normalizeFootballDataMatch(m, teamMap, TBD_TEAM_ID))
      .filter((m): m is DbMatchRow => m !== null);
  }
}
