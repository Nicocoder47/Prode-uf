export interface Team {
  id: string;
  name: string;
  shortName: string;
  countryCode: string;
  flag: string;
  group: string;
  fifaRanking: number;
  coach: string;
  confederation: string;
  marketValue: number;
}

export interface Player {
  id: string;
  name: string;
  photo: string;
  teamId: string;
  position: string;
  age: number;
  height: number;
  weight: number;
  club: string;
  marketValue: number;
  rating: number;
  goals: number;
  assists: number;
  appearances: number;
}

export interface Match {
  id: string;
  stage: string;
  group: string | null;
  stadiumId: string;
  city: string;
  country: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: string; // ISO 8601
  status: 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed';
  homeScore: number | null;
  awayScore: number | null;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  playerId: string;
  eventType: 'goal' | 'yellow_card' | 'red_card' | 'sub_in' | 'sub_out' | 'var';
  minute: number;
  detail: string;
}