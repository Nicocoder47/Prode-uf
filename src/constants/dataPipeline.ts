/** Equipos prioritarios — pipeline controlado (no global hasta READY_FOR_UI). */
export const PRIORITY_TEAMS = [
  'Argentina',
  'Brazil',
  'France',
  'England',
  'Spain',
  'Portugal',
  'Germany',
  'Netherlands',
  'Uruguay',
  'Belgium',
] as const;

export type PriorityTeamName = (typeof PRIORITY_TEAMS)[number];

export const UI_READINESS_THRESHOLDS = {
  verifiedPct: 80,
  photoPct: 80,
  clubPct: 80,
} as const;

export type UiReadiness = 'READY_FOR_UI' | 'IN_PROGRESS';

export function computeUiReadiness(metrics: {
  verifiedPct: number;
  photoPct: number;
  clubPct: number;
}): UiReadiness {
  const { verifiedPct, photoPct, clubPct } = UI_READINESS_THRESHOLDS;
  return metrics.verifiedPct >= verifiedPct &&
    metrics.photoPct >= photoPct &&
    metrics.clubPct >= clubPct
    ? 'READY_FOR_UI'
    : 'IN_PROGRESS';
}
