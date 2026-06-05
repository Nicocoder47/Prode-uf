export const queryKeys = {
  matches: () => ['matches'] as const,
  upcomingMatches: () => ['matches', 'upcoming'] as const,
  match: (matchId: string) => ['match', matchId] as const,
  matchRatings: (matchId: string) => ['match', matchId, 'ratings'] as const,
  teams: () => ['teams'] as const,
  players: () => ['players'] as const,
}
