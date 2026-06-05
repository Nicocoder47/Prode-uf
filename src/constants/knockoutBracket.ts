import type { MatchStage } from '../types/worldcup';

/** Equipo TBD canónico (migration phase_b_knockout). */
export const TBD_TEAM_ID = '00000000-0000-4000-8000-000000000001';

export type GroupLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export type WinnerSlot = '1A' | '1B' | '1D' | '1E' | '1G' | '1I' | '1K' | '1L';

/** Fuente de slot en bracket: posición de grupo, tercero asignado o ganador de partido previo. */
export type BracketSource =
  | `1${GroupLetter}`
  | `2${GroupLetter}`
  | `3@${WinnerSlot}`
  | `W${string}`
  | `L${string}`;

export type KnockoutMatchTemplate = {
  bracketKey: string;
  fifaMatchNo: number;
  stage: MatchStage;
  phase: string;
  round: string;
  providerMatchId: string;
  homeSource: BracketSource;
  awaySource: BracketSource;
  homePlaceholder: string;
  awayPlaceholder: string;
};

/** Plantillas oficiales WC 2026 — provider_match_id desde football-data.org */
export const KNOCKOUT_MATCH_TEMPLATES: KnockoutMatchTemplate[] = [
  { bracketKey: 'M73', fifaMatchNo: 73, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537417', homeSource: '2A', awaySource: '2B', homePlaceholder: '2.º Grupo A', awayPlaceholder: '2.º Grupo B' },
  { bracketKey: 'M76', fifaMatchNo: 76, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537423', homeSource: '1C', awaySource: '2F', homePlaceholder: '1.º Grupo C', awayPlaceholder: '2.º Grupo F' },
  { bracketKey: 'M74', fifaMatchNo: 74, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537415', homeSource: '1E', awaySource: '3@1E', homePlaceholder: '1.º Grupo E', awayPlaceholder: '3.º (A/B/C/D/F)' },
  { bracketKey: 'M75', fifaMatchNo: 75, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537418', homeSource: '1F', awaySource: '2C', homePlaceholder: '1.º Grupo F', awayPlaceholder: '2.º Grupo C' },
  { bracketKey: 'M78', fifaMatchNo: 78, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537424', homeSource: '2E', awaySource: '2I', homePlaceholder: '2.º Grupo E', awayPlaceholder: '2.º Grupo I' },
  { bracketKey: 'M77', fifaMatchNo: 77, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537416', homeSource: '1I', awaySource: '3@1I', homePlaceholder: '1.º Grupo I', awayPlaceholder: '3.º (C/D/F/G/H)' },
  { bracketKey: 'M79', fifaMatchNo: 79, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537425', homeSource: '1A', awaySource: '3@1A', homePlaceholder: '1.º Grupo A', awayPlaceholder: '3.º (C/E/F/H/I)' },
  { bracketKey: 'M80', fifaMatchNo: 80, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537426', homeSource: '1L', awaySource: '3@1L', homePlaceholder: '1.º Grupo L', awayPlaceholder: '3.º (E/H/I/J/K)' },
  { bracketKey: 'M82', fifaMatchNo: 82, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537422', homeSource: '1G', awaySource: '3@1G', homePlaceholder: '1.º Grupo G', awayPlaceholder: '3.º (A/E/H/I/J)' },
  { bracketKey: 'M81', fifaMatchNo: 81, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537421', homeSource: '1D', awaySource: '3@1D', homePlaceholder: '1.º Grupo D', awayPlaceholder: '3.º (B/E/F/I/J)' },
  { bracketKey: 'M84', fifaMatchNo: 84, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537420', homeSource: '1H', awaySource: '2J', homePlaceholder: '1.º Grupo H', awayPlaceholder: '2.º Grupo J' },
  { bracketKey: 'M83', fifaMatchNo: 83, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537419', homeSource: '2K', awaySource: '2L', homePlaceholder: '2.º Grupo K', awayPlaceholder: '2.º Grupo L' },
  { bracketKey: 'M85', fifaMatchNo: 85, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537429', homeSource: '1B', awaySource: '3@1B', homePlaceholder: '1.º Grupo B', awayPlaceholder: '3.º (E/F/G/I/J)' },
  { bracketKey: 'M88', fifaMatchNo: 88, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537428', homeSource: '2D', awaySource: '2G', homePlaceholder: '2.º Grupo D', awayPlaceholder: '2.º Grupo G' },
  { bracketKey: 'M86', fifaMatchNo: 86, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537427', homeSource: '1J', awaySource: '2H', homePlaceholder: '1.º Grupo J', awayPlaceholder: '2.º Grupo H' },
  { bracketKey: 'M87', fifaMatchNo: 87, stage: 'round32', phase: 'LAST_32', round: 'LAST_32', providerMatchId: '537430', homeSource: '1K', awaySource: '3@1K', homePlaceholder: '1.º Grupo K', awayPlaceholder: '3.º (D/E/I/J/L)' },

  { bracketKey: 'M89', fifaMatchNo: 89, stage: 'round16', phase: 'LAST_16', round: 'LAST_16', providerMatchId: '537375', homeSource: 'W74', awaySource: 'W77', homePlaceholder: 'Ganador M74', awayPlaceholder: 'Ganador M77' },
  { bracketKey: 'M90', fifaMatchNo: 90, stage: 'round16', phase: 'LAST_16', round: 'LAST_16', providerMatchId: '537376', homeSource: 'W73', awaySource: 'W75', homePlaceholder: 'Ganador M73', awayPlaceholder: 'Ganador M75' },
  { bracketKey: 'M91', fifaMatchNo: 91, stage: 'round16', phase: 'LAST_16', round: 'LAST_16', providerMatchId: '537377', homeSource: 'W76', awaySource: 'W78', homePlaceholder: 'Ganador M76', awayPlaceholder: 'Ganador M78' },
  { bracketKey: 'M92', fifaMatchNo: 92, stage: 'round16', phase: 'LAST_16', round: 'LAST_16', providerMatchId: '537378', homeSource: 'W79', awaySource: 'W80', homePlaceholder: 'Ganador M79', awayPlaceholder: 'Ganador M80' },
  { bracketKey: 'M93', fifaMatchNo: 93, stage: 'round16', phase: 'LAST_16', round: 'LAST_16', providerMatchId: '537379', homeSource: 'W83', awaySource: 'W84', homePlaceholder: 'Ganador M83', awayPlaceholder: 'Ganador M84' },
  { bracketKey: 'M94', fifaMatchNo: 94, stage: 'round16', phase: 'LAST_16', round: 'LAST_16', providerMatchId: '537380', homeSource: 'W81', awaySource: 'W82', homePlaceholder: 'Ganador M81', awayPlaceholder: 'Ganador M82' },
  { bracketKey: 'M95', fifaMatchNo: 95, stage: 'round16', phase: 'LAST_16', round: 'LAST_16', providerMatchId: '537381', homeSource: 'W86', awaySource: 'W88', homePlaceholder: 'Ganador M86', awayPlaceholder: 'Ganador M88' },
  { bracketKey: 'M96', fifaMatchNo: 96, stage: 'round16', phase: 'LAST_16', round: 'LAST_16', providerMatchId: '537382', homeSource: 'W85', awaySource: 'W87', homePlaceholder: 'Ganador M85', awayPlaceholder: 'Ganador M87' },

  { bracketKey: 'M97', fifaMatchNo: 97, stage: 'quarterfinals', phase: 'QUARTER_FINALS', round: 'QUARTER_FINALS', providerMatchId: '537383', homeSource: 'W89', awaySource: 'W90', homePlaceholder: 'Ganador M89', awayPlaceholder: 'Ganador M90' },
  { bracketKey: 'M98', fifaMatchNo: 98, stage: 'quarterfinals', phase: 'QUARTER_FINALS', round: 'QUARTER_FINALS', providerMatchId: '537384', homeSource: 'W93', awaySource: 'W94', homePlaceholder: 'Ganador M93', awayPlaceholder: 'Ganador M94' },
  { bracketKey: 'M99', fifaMatchNo: 99, stage: 'quarterfinals', phase: 'QUARTER_FINALS', round: 'QUARTER_FINALS', providerMatchId: '537385', homeSource: 'W91', awaySource: 'W92', homePlaceholder: 'Ganador M91', awayPlaceholder: 'Ganador M92' },
  { bracketKey: 'M100', fifaMatchNo: 100, stage: 'quarterfinals', phase: 'QUARTER_FINALS', round: 'QUARTER_FINALS', providerMatchId: '537386', homeSource: 'W95', awaySource: 'W96', homePlaceholder: 'Ganador M95', awayPlaceholder: 'Ganador M96' },

  { bracketKey: 'M101', fifaMatchNo: 101, stage: 'semifinals', phase: 'SEMI_FINALS', round: 'SEMI_FINALS', providerMatchId: '537387', homeSource: 'W97', awaySource: 'W98', homePlaceholder: 'Ganador M97', awayPlaceholder: 'Ganador M98' },
  { bracketKey: 'M102', fifaMatchNo: 102, stage: 'semifinals', phase: 'SEMI_FINALS', round: 'SEMI_FINALS', providerMatchId: '537388', homeSource: 'W99', awaySource: 'W100', homePlaceholder: 'Ganador M99', awayPlaceholder: 'Ganador M100' },

  { bracketKey: 'M103', fifaMatchNo: 103, stage: 'thirdplace', phase: 'THIRD_PLACE', round: 'THIRD_PLACE', providerMatchId: '537389', homeSource: 'L101', awaySource: 'L102', homePlaceholder: 'Perdedor M101', awayPlaceholder: 'Perdedor M102' },
  { bracketKey: 'M104', fifaMatchNo: 104, stage: 'final', phase: 'FINAL', round: 'FINAL', providerMatchId: '537390', homeSource: 'W101', awaySource: 'W102', homePlaceholder: 'Ganador M101', awayPlaceholder: 'Ganador M102' },
];

export const KNOCKOUT_TEMPLATE_BY_KEY = new Map(KNOCKOUT_MATCH_TEMPLATES.map(t => [t.bracketKey, t]));
export const KNOCKOUT_TEMPLATE_BY_PROVIDER_ID = new Map(KNOCKOUT_MATCH_TEMPLATES.map(t => [t.providerMatchId, t]));

export function isKnockoutPhase(phase: string | null | undefined): boolean {
  if (!phase) return false;
  const p = phase.toUpperCase();
  return p !== 'GROUP_STAGE' && p !== 'GROUP';
}
