/**
 * Normalizadores football-data.org → columnas reales Supabase (snake_case).
 * IDs estables: provider=football_data, provider_*_id=<id numérico API>.
 */
import { resolveTeamConfederation } from '../../utils/teamMetadata';

export const FOOTBALL_DATA_PROVIDER = 'football_data';

export interface DbTeamRow {
  provider: string;
  provider_team_id: string;
  name: string;
  short_name: string | null;
  code: string;
  country_code: string | null;
  flag_url: string | null;
  crest_url: string | null;
  group_label: string | null;
  fifa_ranking: number | null;
  coach: string | null;
  confederation: string | null;
  updated_at: string;
}

export interface DbPlayerRow {
  provider: string;
  provider_player_id: string;
  team_id: string;
  name: string;
  position: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  shirt_number: number | null;
  photo_url: string | null;
  club: string | null;
  market_value: number | null;
  rating: number | null;
  height: number | null;
  preferred_foot: string | null;
  updated_at: string;
}

export interface DbMatchRow {
  provider: string;
  provider_match_id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  kick_off: string;
  phase: string | null;
  round: string | null;
  group_label: string | null;
  status: string;
  score_home: number | null;
  score_away: number | null;
  score_home_penalties: number | null;
  score_away_penalties: number | null;
  score_home_after_et: number | null;
  score_away_after_et: number | null;
  stadium: string | null;
  city: string | null;
  updated_at: string;
}

export interface DbStandingRow {
  team_id: string;
  group_label: string | null;
  phase: string;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  competition_code: string | null;
  season: number | null;
  provider: string;
  updated_at: string;
}

function extractGroupLabel(group?: string | null): string | null {
  if (!group) return null;
  const m = group.match(/GROUP_?([A-L])/i) ?? group.match(/^([A-L])$/i);
  return m ? m[1].toUpperCase() : null;
}

function teamCode(raw: { tla?: string; shortName?: string; name?: string; id?: number }): string {
  if (raw.tla) return raw.tla.toUpperCase();
  if (raw.shortName && raw.shortName.length <= 5) return raw.shortName.toUpperCase().replace(/\s/g, '');
  if (raw.name) return raw.name.substring(0, 3).toUpperCase();
  return `T${raw.id ?? 0}`;
}

function extractFootballDataScores(
  score:
    | {
        regularTime?: { home?: number | null; away?: number | null };
        fullTime?: { home?: number | null; away?: number | null };
        halfTime?: { home?: number | null; away?: number | null };
        extraTime?: { home?: number | null; away?: number | null };
      }
    | undefined,
  mappedStatus: string,
): {
  home: number | null;
  away: number | null;
  homeAfterEt: number | null;
  awayAfterEt: number | null;
} {
  const rtHome = score?.regularTime?.home;
  const rtAway = score?.regularTime?.away;
  const ftHome = score?.fullTime?.home;
  const ftAway = score?.fullTime?.away;
  const etHome = score?.extraTime?.home;
  const etAway = score?.extraTime?.away;

  // 90': regularTime en partidos con alargue/penales; fullTime en fase de grupos.
  let home: number | null = rtHome ?? ftHome ?? null;
  let away: number | null = rtAway ?? ftAway ?? null;

  if (home != null && away != null) {
    const homeAfterEt =
      etHome != null && etAway != null ? home + etHome : null;
    const awayAfterEt =
      etHome != null && etAway != null ? away + etAway : null;
    return { home, away, homeAfterEt, awayAfterEt };
  }

  if (mappedStatus === 'live' || mappedStatus === 'halftime') {
    const htHome = score?.halfTime?.home;
    const htAway = score?.halfTime?.away;
    if (htHome != null && htAway != null) {
      return { home: htHome, away: htAway, homeAfterEt: null, awayAfterEt: null };
    }
  }

  return { home, away, homeAfterEt: null, awayAfterEt: null };
}

export function mapFootballDataStatus(status: string): string {
  const map: Record<string, string> = {
    SCHEDULED: 'scheduled',
    TIMED: 'scheduled',
    IN_PLAY: 'live',
    PAUSED: 'halftime',
    FINISHED: 'finished',
    POSTPONED: 'postponed',
    SUSPENDED: 'suspended',
    CANCELLED: 'cancelled',
  };
  return map[status] ?? 'scheduled';
}

export function normalizeFootballDataTeam(
  raw: Record<string, unknown>,
  groupHint?: string | null
): DbTeamRow {
  const id = String(raw.id ?? '');
  const crest = (raw.crest as string) ?? null;
  const code = teamCode(raw as { tla?: string; shortName?: string; name?: string; id?: number });
  const areaName = (raw.area as { name?: string })?.name ?? null;
  const areaCode = (raw.area as { code?: string })?.code ?? null;

  return {
    provider: FOOTBALL_DATA_PROVIDER,
    provider_team_id: id,
    name: String(raw.name ?? 'Unknown'),
    short_name: (raw.shortName as string) ?? null,
    code,
    country_code: areaCode ?? code,
    flag_url: crest,
    crest_url: crest,
    group_label: extractGroupLabel(groupHint ?? (raw.group as string)) ?? null,
    fifa_ranking: null,
    coach: (raw.coach as { name?: string })?.name ?? null,
    confederation: resolveTeamConfederation(String(raw.name ?? ''), code, areaName),
    updated_at: new Date().toISOString(),
  };
}

export function normalizeFootballDataPlayer(
  raw: Record<string, unknown>,
  teamUuid: string
): DbPlayerRow {
  const id = String(raw.id ?? '');
  return {
    provider: FOOTBALL_DATA_PROVIDER,
    provider_player_id: id,
    team_id: teamUuid,
    name: String(raw.name ?? 'Unknown'),
    position: (raw.position as string) ?? null,
    date_of_birth: (raw.dateOfBirth as string) ?? null,
    nationality: (raw.nationality as string) ?? null,
    shirt_number: typeof raw.shirtNumber === 'number' ? raw.shirtNumber : null,
    photo_url: null,
    club: null,
    market_value: null,
    height: null,
    preferred_foot: null,
    rating: null,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeFootballDataMatch(
  raw: Record<string, unknown>,
  teamUuidByProviderId: Map<string, string>,
  tbdTeamId?: string
): DbMatchRow | null {
  const home = raw.homeTeam as { id?: number } | undefined;
  const away = raw.awayTeam as { id?: number } | undefined;
  const stage = String(raw.stage ?? raw.matchday ?? '');
  const isKnockout = stage && !stage.includes('GROUP');

  let homeUuid = home?.id != null ? teamUuidByProviderId.get(String(home.id)) ?? null : null;
  let awayUuid = away?.id != null ? teamUuidByProviderId.get(String(away.id)) ?? null : null;

  if (!isKnockout && (!homeUuid || !awayUuid)) return null;

  if (isKnockout && tbdTeamId) {
    if (!homeUuid) homeUuid = tbdTeamId;
    if (!awayUuid) awayUuid = tbdTeamId;
  } else if (!homeUuid || !awayUuid) {
    return null;
  }

  const score = raw.score as {
    fullTime?: { home?: number | null; away?: number | null };
    halfTime?: { home?: number | null; away?: number | null };
    extraTime?: { home?: number | null; away?: number | null };
    penalties?: { home?: number | null; away?: number | null };
  } | undefined;

  const mappedStatus = mapFootballDataStatus(String(raw.status ?? 'SCHEDULED'));
  const { home: scoreHome, away: scoreAway, homeAfterEt, awayAfterEt } = extractFootballDataScores(score, mappedStatus);

  const group = extractGroupLabel(raw.group as string);

  return {
    provider: FOOTBALL_DATA_PROVIDER,
    provider_match_id: String(raw.id ?? ''),
    home_team_id: homeUuid,
    away_team_id: awayUuid,
    kick_off: String(raw.utcDate ?? new Date().toISOString()),
    phase: stage || null,
    round: stage || null,
    group_label: group,
    status: mappedStatus,
    score_home: scoreHome,
    score_away: scoreAway,
    score_home_penalties: score?.penalties?.home ?? null,
    score_away_penalties: score?.penalties?.away ?? null,
    score_home_after_et: homeAfterEt,
    score_away_after_et: awayAfterEt,
    stadium: typeof raw.venue === 'string' ? raw.venue : null,
    city: null,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeFootballDataStanding(
  tableRow: Record<string, unknown>,
  teamUuid: string,
  groupLabel: string | null,
  competitionCode: string,
  season: number | null
): DbStandingRow {
  return {
    team_id: teamUuid,
    group_label: groupLabel,
    phase: 'group',
    rank: Number(tableRow.position ?? 0),
    played: Number(tableRow.playedGames ?? 0),
    won: Number(tableRow.won ?? 0),
    drawn: Number(tableRow.draw ?? 0),
    lost: Number(tableRow.lost ?? 0),
    goals_for: Number(tableRow.goalsFor ?? 0),
    goals_against: Number(tableRow.goalsAgainst ?? 0),
    goal_diff: Number(tableRow.goalDifference ?? 0),
    points: Number(tableRow.points ?? 0),
    competition_code: competitionCode,
    season,
    provider: FOOTBALL_DATA_PROVIDER,
    updated_at: new Date().toISOString(),
  };
}
