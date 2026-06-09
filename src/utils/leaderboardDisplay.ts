import type { LeaderboardEntry } from '../types/worldcup';

/** Oculta jugadores sin puntos hasta que el Mundial empiece a sumar scores. */
export function filterActiveLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries
    .filter(entry => entry.points > 0)
    .sort((a, b) => b.points - a.points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
