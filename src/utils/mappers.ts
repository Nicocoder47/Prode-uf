import { teamDisplayName } from './teamDisplay';
import type {
  Match,
  Team,
  Player,
  MatchStatus,
  MatchStage,
  Prediction,
  PredictionResult,
  Standing,
  PlayerLiveStatusEntry,
  LeaderboardEntry,
} from '../types/worldcup';

const isObject = (val: unknown): val is Record<string, unknown> =>
  val !== null && typeof val === 'object' && !Array.isArray(val);

function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const diff = Date.now() - birth.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export function createTbdTeam(id: string): Team {
  return {
    id,
    name: 'Equipo por definir',
    code: 'TBD',
    shortName: 'TBD',
    countryCode: '',
    flag: '🏳️',
    group: '',
    fifaRanking: null,
    coach: null,
    confederation: null,
  };
}

export function normalizeStage(phase?: string | null): MatchStage {
  const p = (phase ?? '').toLowerCase();
  if (p.includes('final') && !p.includes('semi') && !p.includes('quarter') && !p.includes('1/')) {
    return p.includes('third') || p.includes('3rd') ? 'thirdplace' : 'final';
  }
  if (p.includes('third') || p.includes('3rd')) return 'thirdplace';
  if (p.includes('semi')) return 'semifinals';
  if (p.includes('quarter') || p.includes('1/4')) return 'quarterfinals';
  if (p.includes('16') || p.includes('1/8') || p.includes('octav')) return 'round16';
  if (p.includes('32') || p.includes('1/16')) return 'round32';
  return 'group';
}

export function mapDbTeamToTeam(dbTeam: Record<string, unknown>): Team {
  const code = String(dbTeam.code ?? dbTeam.short_name ?? 'TBD');
  const rawName = String(dbTeam.name ?? 'Equipo por definir');
  return {
    id: String(dbTeam.id),
    name: teamDisplayName({ code, name: rawName }),
    code,
    shortName: String(dbTeam.code ?? dbTeam.short_name ?? 'TBD'),
    countryCode: String(dbTeam.country_code ?? dbTeam.code ?? ''),
    flag: String(dbTeam.flag_url ?? dbTeam.crest_url ?? dbTeam.flag ?? '🏳️'),
    group: String(dbTeam.group_label ?? dbTeam.group ?? ''),
    fifaRanking: (dbTeam.fifa_ranking as number | null) ?? null,
    coach: (dbTeam.coach as string | null) ?? null,
    confederation: (dbTeam.confederation as string | null) ?? null,
    marketValue: (dbTeam.market_value as number | undefined) ?? undefined,
  };
}

export function mapDbPlayerToPlayer(dbPlayer: Record<string, unknown>): Player {
  const teamRel = isObject(dbPlayer.team_id)
    ? dbPlayer.team_id
    : isObject(dbPlayer.team)
      ? dbPlayer.team
      : isObject(dbPlayer.teams)
        ? dbPlayer.teams
        : null;

  const stats = isObject(dbPlayer.stats) ? dbPlayer.stats : {};

  return {
    id: String(dbPlayer.id),
    name: String(dbPlayer.name),
    photo: (dbPlayer.photo_url as string | null) ?? (dbPlayer.photo as string | null) ?? null,
    photoUrl: (dbPlayer.photo_url as string | null) ?? (dbPlayer.photoUrl as string | null) ?? null,
    provider: (dbPlayer.provider as string | null) ?? null,
    providerPlayerId: (dbPlayer.provider_player_id as string | null) ?? null,
    apiFootballId: (dbPlayer.api_football_id as string | null) ?? null,
    theSportsDbId: (dbPlayer.thesportsdb_id as string | null) ?? null,
    teamId: teamRel && isObject(teamRel) ? String(teamRel.id) : String(dbPlayer.team_id ?? ''),
    team: teamRel && isObject(teamRel) ? mapDbTeamToTeam(teamRel) : undefined,
    position: (dbPlayer.position as string | null) ?? null,
    shirtNumber: (dbPlayer.shirt_number as number | null) ?? null,
    age: ageFromDob(dbPlayer.date_of_birth as string | null),
    dateOfBirth: (dbPlayer.date_of_birth as string | null) ?? null,
    nationality: (dbPlayer.nationality as string | null) ?? null,
    height: (dbPlayer.height as number | null) ?? null,
    weight: (dbPlayer.weight as number | null) ?? null,
    preferredFoot: (dbPlayer.preferred_foot as string | null) ?? null,
    birthPlace: (dbPlayer.birth_place as string | null) ?? null,
    detailedPosition: (dbPlayer.detailed_position as string | null) ?? null,
    dataQualityScore: (dbPlayer.data_quality_score as number | null) ?? undefined,
    dataSources: (dbPlayer.data_sources as Record<string, string> | null) ?? undefined,
    lastEnrichedAt: (dbPlayer.last_enriched_at as string | null) ?? null,
    enrichmentStatus: (dbPlayer.enrichment_status as string | null) ?? null,
    verificationStatus: (dbPlayer.verification_status as string | null) ?? null,
    identityConfidenceScore: (dbPlayer.identity_confidence_score as number | null) ?? null,
    club: (dbPlayer.club as string | null) ?? null,
    marketValue: (dbPlayer.market_value as number | null) ?? null,
    marketValueEur: (dbPlayer.market_value_eur as number | null) ?? (dbPlayer.market_value as number | null) ?? null,
    rating:
      dbPlayer.rating != null && Number(dbPlayer.rating) > 0
        ? Number(dbPlayer.rating)
        : stats.rating != null && Number(stats.rating) > 0
          ? Number(stats.rating)
          : null,
    goals: Number(dbPlayer.goals ?? stats.goals ?? 0),
    assists: Number(dbPlayer.assists ?? stats.assists ?? 0),
    appearances: Number(dbPlayer.appearances ?? stats.appearances ?? 0),
  };
}

export function mapDbMatchToMatch(dbMatch: Record<string, unknown>): Match {
  const homeRel = isObject(dbMatch.home_team)
    ? dbMatch.home_team
    : isObject(dbMatch.home_team_id)
      ? dbMatch.home_team_id
      : null;
  const awayRel = isObject(dbMatch.away_team)
    ? dbMatch.away_team
    : isObject(dbMatch.away_team_id)
      ? dbMatch.away_team_id
      : null;

  const homeTeamId = homeRel && isObject(homeRel) ? String(homeRel.id) : String(dbMatch.home_team_id ?? '');
  const awayTeamId = awayRel && isObject(awayRel) ? String(awayRel.id) : String(dbMatch.away_team_id ?? '');
  const kickoff = String(dbMatch.kick_off ?? dbMatch.kickoff ?? '');

  return {
    id: String(dbMatch.id),
    stage: normalizeStage((dbMatch.phase ?? dbMatch.stage ?? dbMatch.round) as string | null),
    round: (dbMatch.round as string | null) ?? null,
    group: (dbMatch.group_label as string | null) ?? (dbMatch.group as string | null) ?? null,
    stadium: (dbMatch.stadium as string | null) ?? null,
    stadiumId: (dbMatch.stadium as string | null) ?? (dbMatch.stadium_id as string | null) ?? null,
    city: (dbMatch.city as string | null) ?? null,
    country: (dbMatch.country as string | null) ?? null,
    homeTeamId,
    awayTeamId,
    homeTeam: homeRel && isObject(homeRel) ? mapDbTeamToTeam(homeRel) : homeTeamId ? createTbdTeam(homeTeamId) : undefined,
    awayTeam: awayRel && isObject(awayRel) ? mapDbTeamToTeam(awayRel) : awayTeamId ? createTbdTeam(awayTeamId) : undefined,
    kickoff,
    date: kickoff,
    status: ((dbMatch.status as MatchStatus) ?? 'scheduled') as MatchStatus,
    homeScore: (dbMatch.score_home as number | null) ?? (dbMatch.home_score as number | null) ?? null,
    awayScore: (dbMatch.score_away as number | null) ?? (dbMatch.away_score as number | null) ?? null,
    referee: (dbMatch.referee as string | null) ?? null,
    mvpPlayerId: (dbMatch.mvp_player_id as string | null) ?? null,
    isLocked: Boolean(dbMatch.is_locked ?? false),
  };
}

export function mapDbStandingToStanding(dbRow: Record<string, unknown>): Standing {
  const teamRel = isObject(dbRow.team_id) ? dbRow.team_id : isObject(dbRow.team) ? dbRow.team : null;

  return {
    id: String(dbRow.id),
    teamId: teamRel && isObject(teamRel) ? String(teamRel.id) : String(dbRow.team_id ?? ''),
    team: teamRel && isObject(teamRel) ? mapDbTeamToTeam(teamRel) : undefined,
    groupLabel: (dbRow.group_label as string | null) ?? null,
    phase: String(dbRow.phase ?? 'group'),
    rank: Number(dbRow.rank ?? 0),
    played: Number(dbRow.played ?? 0),
    won: Number(dbRow.won ?? 0),
    drawn: Number(dbRow.drawn ?? 0),
    lost: Number(dbRow.lost ?? 0),
    goalsFor: Number(dbRow.goals_for ?? 0),
    goalsAgainst: Number(dbRow.goals_against ?? 0),
    goalDiff: Number(dbRow.goal_diff ?? 0),
    points: Number(dbRow.points ?? 0),
  };
}

export function mapDbPredictionToPrediction(dbPred: Record<string, unknown>): Prediction {
  const result = (dbPred.predicted_winner ?? null) as PredictionResult | null;
  const home = dbPred.predicted_score_home;
  const away = dbPred.predicted_score_away;
  const hasScore = home !== null && home !== undefined && away !== null && away !== undefined;

  return {
    id: String(dbPred.id),
    userId: String(dbPred.user_id),
    matchId: String(dbPred.match_id),
    result,
    exactScore: hasScore ? { home: Number(home), away: Number(away) } : null,
    predictedHomeScore: (home as number | null) ?? null,
    predictedAwayScore: (away as number | null) ?? null,
    predictedFirstScorerId: (dbPred.predicted_first_scorer as string | null) ?? null,
    predictedMvpId: (dbPred.predicted_mvp as string | null) ?? null,
    tokenCost: (dbPred.token_cost as number | undefined) ?? undefined,
    points: Number(dbPred.points ?? 0),
    status: String(dbPred.status ?? 'pending'),
    createdAt: String(dbPred.created_at ?? ''),
    updatedAt: String(dbPred.updated_at ?? ''),
  };
}

export function mapDbLeaderboardEntry(row: Record<string, unknown>): LeaderboardEntry {
  const profile = isObject(row.profiles) ? row.profiles : isObject(row.profile) ? row.profile : null;

  return {
    userId: String(row.user_id),
    rank: Number(row.rank ?? 0),
    points: Number(row.points ?? 0),
    wins: Number(row.wins ?? 0),
    draws: Number(row.draws ?? 0),
    losses: Number(row.losses ?? 0),
    profile: profile
      ? {
          fullName:
            (profile.full_name as string | undefined) ??
            (profile.display_name as string | undefined) ??
            undefined,
          legajo: (profile.legajo as string | undefined) ?? undefined,
          avatarUrl: (profile.avatar_url as string | undefined) ?? undefined,
        }
      : null,
  };
}

export function mapDbPlayerLiveStatus(row: Record<string, unknown>): PlayerLiveStatusEntry {
  const playerRel = isObject(row.player) ? row.player : isObject(row.player_id) ? row.player_id : null;
  const teamRel = isObject(row.team) ? row.team : isObject(row.team_id) ? row.team_id : null;
  const matchRel = isObject(row.match) ? row.match : isObject(row.match_id) ? row.match_id : null;

  return {
    id: String(row.id),
    matchId: String(row.match_id),
    playerId: String(row.player_id),
    teamId: String(row.team_id),
    status: String(row.status ?? 'not_started'),
    isStarting: Boolean(row.is_starting ?? false),
    isSubstitute: Boolean(row.is_substitute ?? false),
    isSubstituted: Boolean(row.is_substituted ?? false),
    minuteIn: (row.minute_in as number | null) ?? null,
    minuteOut: (row.minute_out as number | null) ?? null,
    goals: Number(row.goals ?? 0),
    assists: Number(row.assists ?? 0),
    yellowCards: Number(row.yellow_cards ?? 0),
    redCards: Number(row.red_cards ?? 0),
    rating: row.rating != null ? Number(row.rating) : null,
    player: playerRel && isObject(playerRel)
      ? {
          id: String(playerRel.id),
          name: String(playerRel.name ?? ''),
          photo: (playerRel.photo_url as string | null) ?? null,
          position: (playerRel.position as string | null) ?? null,
        }
      : undefined,
    team: teamRel && isObject(teamRel)
      ? {
          id: String(teamRel.id),
          name: String(teamRel.name ?? ''),
          code: String(teamRel.code ?? 'TBD'),
          flag: String(teamRel.flag_url ?? teamRel.crest_url ?? '🏳️'),
        }
      : undefined,
    match: matchRel && isObject(matchRel)
      ? {
          id: String(matchRel.id),
          status: String(matchRel.status ?? ''),
          kickoff: String(matchRel.kick_off ?? matchRel.kickoff ?? ''),
        }
      : undefined,
  };
}
