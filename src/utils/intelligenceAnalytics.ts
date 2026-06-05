import type { Match, MatchStage, Player, Team } from '../types/worldcup';
import { computeTeamForm, formBreakdown, type FormResult } from './teamAnalytics';

export type TrendDirection = 'up' | 'down' | 'stable' | 'unknown';

export interface RecentMatchEntry {
  matchId: string;
  date: string;
  opponent: Team;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: FormResult;
  stage: MatchStage;
  isOfficial: boolean;
}

export interface OpponentRecord {
  team: Team;
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface TeamIntelligence {
  entityType: 'team';
  team: Team;
  form: FormResult[];
  formIndex: number | null;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  avgGoalsFor: number | null;
  avgGoalsAgainst: number | null;
  officialMatches: number;
  friendlyMatches: number;
  recentHistory: RecentMatchEntry[];
  opponents: OpponentRecord[];
  trend: TrendDirection;
  trendLabel: string;
  wins: number;
  draws: number;
  losses: number;
  sampleSize: number;
}

export interface PlayerIntelligence {
  entityType: 'player';
  player: Player;
  appearances: number;
  goals: number;
  assists: number;
  rating: number | null;
  avgGoalsPerMatch: number | null;
  teamForm: FormResult[];
  teamFormIndex: number | null;
}

export interface MatchIntelligence {
  entityType: 'match';
  match: Match;
  home: TeamIntelligence;
  away: TeamIntelligence;
  headToHead: RecentMatchEntry[];
}

export interface TeamCompareSnapshot {
  team: Team;
  fifaRanking: number | null;
  squadValue: number | null;
  averageAge: number | null;
  form: FormResult[];
  formIndex: number | null;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  avgGoalsFor: number | null;
}

const OFFICIAL_STAGES: MatchStage[] = [
  'group', 'round32', 'round16', 'quarterfinals', 'semifinals', 'thirdplace', 'final',
];

function isOfficialMatch(m: Match): boolean {
  return OFFICIAL_STAGES.includes(m.stage);
}

function getTeamFinishedMatches(matches: Match[], teamId: string): Match[] {
  return matches
    .filter(m => m.status === 'finished' && m.homeScore != null && m.awayScore != null)
    .filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId)
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
}

function matchResultForTeam(m: Match, teamId: string) {
  const isHome = m.homeTeamId === teamId;
  const gf = isHome ? Number(m.homeScore) : Number(m.awayScore);
  const ga = isHome ? Number(m.awayScore) : Number(m.homeScore);
  const result: FormResult = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  return { gf, ga, result, isHome };
}

function computeTrend(form: FormResult[]): { trend: TrendDirection; trendLabel: string } {
  if (form.length < 4) return { trend: 'unknown', trendLabel: 'Muestra insuficiente' };
  const mid = Math.floor(form.length / 2);
  const recent = form.slice(mid);
  const older = form.slice(0, mid);
  const pts = (f: FormResult[]) =>
    f.reduce((s, r) => s + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0) / f.length;
  const diff = pts(recent) - pts(older);
  if (diff > 0.4) return { trend: 'up', trendLabel: 'Tendencia ascendente' };
  if (diff < -0.4) return { trend: 'down', trendLabel: 'Tendencia descendente' };
  return { trend: 'stable', trendLabel: 'Rendimiento estable' };
}

export function buildTeamIntelligence(team: Team, matches: Match[]): TeamIntelligence {
  const finished = getTeamFinishedMatches(matches, team.id);
  const last10 = finished.slice(0, 10);
  const form = computeTeamForm(matches, team.id, 10);
  const { wins, draws, losses } = formBreakdown(form);

  let goalsFor = 0;
  let goalsAgainst = 0;
  let officialMatches = 0;
  let friendlyMatches = 0;

  const recentHistory: RecentMatchEntry[] = last10
    .map(m => {
      const { gf, ga, result, isHome } = matchResultForTeam(m, team.id);
      const opponent = isHome ? m.awayTeam! : m.homeTeam!;
      goalsFor += gf;
      goalsAgainst += ga;
      const official = isOfficialMatch(m);
      if (official) officialMatches++;
      else friendlyMatches++;

      return {
        matchId: m.id,
        date: m.kickoff,
        opponent,
        isHome,
        goalsFor: gf,
        goalsAgainst: ga,
        result,
        stage: m.stage,
        isOfficial: official,
      };
    })
    .reverse();

  const oppMap = new Map<string, OpponentRecord>();
  for (const m of finished) {
    const { result, isHome } = matchResultForTeam(m, team.id);
    const opp = isHome ? m.awayTeam : m.homeTeam;
    if (!opp) continue;
    if (!oppMap.has(opp.id)) {
      oppMap.set(opp.id, { team: opp, played: 0, wins: 0, draws: 0, losses: 0 });
    }
    const rec = oppMap.get(opp.id)!;
    rec.played++;
    if (result === 'W') rec.wins++;
    else if (result === 'D') rec.draws++;
    else rec.losses++;
  }

  const formIndex =
    form.length > 0 ? Math.round(((wins * 3 + draws) / (form.length * 3)) * 100) : null;

  const { trend, trendLabel } = computeTrend(form);

  return {
    entityType: 'team',
    team,
    form,
    formIndex,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    avgGoalsFor: last10.length > 0 ? goalsFor / last10.length : null,
    avgGoalsAgainst: last10.length > 0 ? goalsAgainst / last10.length : null,
    officialMatches,
    friendlyMatches,
    recentHistory,
    opponents: [...oppMap.values()].sort((a, b) => b.played - a.played),
    trend,
    trendLabel,
    wins,
    draws,
    losses,
    sampleSize: last10.length,
  };
}

export function buildPlayerIntelligence(
  player: Player,
  stats: { appearances: number; goals: number; assists: number; rating: number | null },
  teamMatches: Match[],
): PlayerIntelligence {
  const teamForm = player.teamId ? computeTeamForm(teamMatches, player.teamId, 10) : [];
  const fb = formBreakdown(teamForm);
  const teamFormIndex =
    teamForm.length > 0
      ? Math.round(((fb.wins * 3 + fb.draws) / (teamForm.length * 3)) * 100)
      : null;

  return {
    entityType: 'player',
    player,
    appearances: stats.appearances,
    goals: stats.goals,
    assists: stats.assists,
    rating: stats.rating,
    avgGoalsPerMatch: stats.appearances > 0 ? stats.goals / stats.appearances : null,
    teamForm,
    teamFormIndex,
  };
}

export function buildMatchIntelligence(match: Match, allMatches: Match[]): MatchIntelligence | null {
  if (!match.homeTeam || !match.awayTeam) return null;

  const homeIntel = buildTeamIntelligence(match.homeTeam, allMatches);
  const awayIntel = buildTeamIntelligence(match.awayTeam, allMatches);

  const headToHead: RecentMatchEntry[] = allMatches
    .filter(m => m.status === 'finished' && m.id !== match.id)
    .filter(
      m =>
        (m.homeTeamId === match.homeTeamId && m.awayTeamId === match.awayTeamId) ||
        (m.homeTeamId === match.awayTeamId && m.awayTeamId === match.homeTeamId),
    )
    .slice(0, 5)
    .map(m => {
      const perspectiveTeamId = match.homeTeamId;
      const { gf, ga, result, isHome } = matchResultForTeam(m, perspectiveTeamId);
      const opponent = isHome ? m.awayTeam! : m.homeTeam!;
      return {
        matchId: m.id,
        date: m.kickoff,
        opponent,
        isHome,
        goalsFor: gf,
        goalsAgainst: ga,
        result,
        stage: m.stage,
        isOfficial: isOfficialMatch(m),
      };
    });

  return { entityType: 'match', match, home: homeIntel, away: awayIntel, headToHead };
}

export function buildTeamCompareSnapshot(
  team: Team,
  matches: Match[],
  squadValue: number | null,
  averageAge: number | null,
): TeamCompareSnapshot {
  const intel = buildTeamIntelligence(team, matches);
  return {
    team,
    fifaRanking: team.fifaRanking,
    squadValue,
    averageAge,
    form: intel.form,
    formIndex: intel.formIndex,
    wins: intel.wins,
    draws: intel.draws,
    losses: intel.losses,
    goalsFor: intel.goalsFor,
    goalsAgainst: intel.goalsAgainst,
    goalDifference: intel.goalDifference,
    avgGoalsFor: intel.avgGoalsFor,
  };
}
