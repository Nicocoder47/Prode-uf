// Modelo de dominio canonico de PRODEMUNDIAL 2026.
// Es la unica fuente de verdad de tipos para la UI. Los mappers (src/utils/mappers.ts)
// traducen las columnas reales de Supabase (SUPABASE_SCHEMA.sql) a estas formas.

export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "cancelled";

// Etapas alineadas con FixtureBoard. round32 = 32avos (formato 48 selecciones).
export type MatchStage =
  | "group"
  | "round32"
  | "round16"
  | "quarterfinals"
  | "semifinals"
  | "thirdplace"
  | "final";

// 12 grupos en el formato de 48 selecciones (A..L).
export type GroupName =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export type Position = 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST' | 'CF';

export interface Team {
  id: string;
  name: string;
  code: string;           // <- teams.code (ARG, BRA, ...)
  shortName: string;      // alias de code para UI
  countryCode: string;    // alias de code
  flag: string;           // <- teams.flag_url (URL o emoji)
  group: string;          // <- teams.group_label
  fifaRanking: number | null;   // <- teams.fifa_ranking
  coach: string | null;         // <- teams.coach
  confederation: string | null; // <- teams.confederation
  marketValue?: number;
  primaryColor?: string;   // propiedad de UI (opcional)
  secondaryColor?: string; // propiedad de UI (opcional)
}

export interface Player {
  id: string;
  name: string;
  photo: string | null;   // <- players.photo_url
  photoUrl?: string | null; // alias API
  provider?: string | null;
  providerPlayerId?: string | null;
  apiFootballId?: string | null;
  theSportsDbId?: string | null;
  teamId: string;         // <- players.team_id
  team?: Team;
  position: string | null;
  shirtNumber?: number | null;
  age: number | null;       // calculado desde players.date_of_birth
  dateOfBirth?: string | null;
  nationality?: string | null;
  height?: number | null;
  weight?: number | null;
  preferredFoot?: string | null;
  club: string | null;
  marketValue: number | null;
  marketValueEur?: number | null;
  rating: number | null;
  birthPlace?: string | null;
  detailedPosition?: string | null;
  dataQualityScore?: number;
  dataSources?: Record<string, string>;
  lastEnrichedAt?: string | null;
  enrichmentStatus?: string | null;
  verificationStatus?: string | null;
  identityConfidenceScore?: number | null;
  goals: number;
  assists: number;
  appearances: number;
}

export interface Stadium {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  image?: string;
}

export interface Match {
  id: string;
  stage: MatchStage;
  round?: string | null;        // <- matches.round (texto crudo del proveedor)
  group: string | null;         // <- matches.group_label
  stadium: string | null;       // <- matches.stadium (texto)
  stadiumId?: string | null;    // compat UI (= stadium)
  city: string | null;
  country?: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: Team;
  awayTeam?: Team;
  kickoff: string;              // ISO 8601 <- matches.kick_off
  date: string;                 // alias de kickoff (consumido por las cards)
  status: MatchStatus;
  homeScore: number | null;     // <- matches.score_home
  awayScore: number | null;     // <- matches.score_away
  referee?: string | null;
  mvpPlayerId?: string | null;
  isLocked?: boolean;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  playerId?: string | null;
  eventType: 'goal' | 'yellow_card' | 'red_card' | 'sub_in' | 'sub_out' | 'var' | string;
  minute: number;
  team?: 'home' | 'away';
  detail?: string;
}

export type PredictionResult = "home" | "draw" | "away";

export interface Prediction {
  id: string;
  userId: string;             // <- predictions.user_id
  matchId: string;            // <- predictions.match_id
  // Forma de UI consumida por MyPredictionsPanel
  result: PredictionResult | null; // <- predictions.predicted_winner
  exactScore?: { home: number; away: number } | null;
  // Campos crudos (para el modal de prediccion)
  predictedHomeScore?: number | null;  // <- predicted_score_home
  predictedAwayScore?: number | null;  // <- predicted_score_away
  predictedFirstScorerId?: string | null;
  predictedMvpId?: string | null;
  tokenCost?: number;
  points: number;
  status: "pending" | "locked" | "scored" | string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupTeamStats {
  teamId: string;
  team?: Team;
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface TopScorer {
  player: Player;
  goals: number;
  assists: number;
}

export interface Standing {
  id: string;
  teamId: string;
  team?: Team;
  groupLabel: string | null;
  phase: string;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface GroupSummary {
  id: string;
  label: string;
  standings: Standing[];
  teams: Team[];
}

export interface PlayerLiveStatusEntry {
  id: string;
  matchId: string;
  playerId: string;
  teamId: string;
  status: string;
  isStarting: boolean;
  isSubstitute: boolean;
  isSubstituted: boolean;
  minuteIn: number | null;
  minuteOut: number | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: number | null;
  player?: Pick<Player, 'id' | 'name' | 'photo' | 'position'>;
  team?: Pick<Team, 'id' | 'name' | 'code' | 'flag'>;
  match?: { id: string; status: string; kickoff: string };
}

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  profile?: { fullName?: string; legajo?: string; avatarUrl?: string } | null;
}
