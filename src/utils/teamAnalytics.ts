import type { Match, Player } from '../types/worldcup';

export type FormResult = 'W' | 'D' | 'L';

export function computeTeamForm(matches: Match[], teamId: string, limit = 10): FormResult[] {
  const finished = matches
    .filter(m => m.status === 'finished' && m.homeScore != null && m.awayScore != null)
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())
    .slice(0, limit);

  return finished
    .map(m => {
      const isHome = m.homeTeamId === teamId;
      const gf = isHome ? Number(m.homeScore) : Number(m.awayScore);
      const ga = isHome ? Number(m.awayScore) : Number(m.homeScore);
      if (gf > ga) return 'W' as const;
      if (gf < ga) return 'L' as const;
      return 'D' as const;
    })
    .reverse();
}

export function formBreakdown(form: FormResult[]) {
  return {
    wins: form.filter(r => r === 'W').length,
    draws: form.filter(r => r === 'D').length,
    losses: form.filter(r => r === 'L').length,
  };
}

export function computeSquadValue(players: Player[]): number | null {
  const values = players.map(p => p.marketValue).filter((v): v is number => v != null && v > 0);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}

export function computeAverageAge(players: Player[]): number | null {
  const ages = players.map(p => p.age).filter((a): a is number => a != null && a > 0);
  if (ages.length === 0) return null;
  return Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
}

export function fmtMarketCompact(value: number | null | undefined): string | null {
  if (!value || value <= 0) return null;
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}K`;
  return `€${value}`;
}

export type TeamScoring = {
  played: number;
  goalsFor: number;
  perMatch: number | null;
};

export function computeTeamScoring(matches: Match[], teamId: string): TeamScoring {
  const finished = matches.filter(
    m =>
      m.status === 'finished' &&
      m.homeScore != null &&
      m.awayScore != null &&
      (m.homeTeamId === teamId || m.awayTeamId === teamId),
  );
  let goalsFor = 0;
  for (const m of finished) {
    goalsFor += m.homeTeamId === teamId ? Number(m.homeScore) : Number(m.awayScore);
  }
  return {
    played: finished.length,
    goalsFor,
    perMatch: finished.length ? goalsFor / finished.length : null,
  };
}

/** Jugadores destacados por rating, luego valor de mercado, luego goles. Solo datos reales. */
export function topPlayersForTeam(players: Player[], limit = 3): Player[] {
  return [...players]
    .sort((a, b) => {
      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      if (rb !== ra) return rb - ra;
      const va = a.marketValue ?? 0;
      const vb = b.marketValue ?? 0;
      if (vb !== va) return vb - va;
      return (b.goals ?? 0) - (a.goals ?? 0);
    })
    .slice(0, limit);
}
