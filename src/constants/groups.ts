import type { GroupName } from '../types/worldcup';

/** 12 grupos del formato WC 2026 (48 selecciones). */
export const WC26_GROUP_NAMES: GroupName[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
];

export function normalizeGroupId(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  const letter = trimmed.match(/(?:group\s*)?([A-L])\b/i)?.[1];
  if (letter) return letter.toUpperCase();
  if (/^[A-L]$/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed.toUpperCase();
}

export function groupMatchesLabel(groupId: string, groupLabel?: string | null): boolean {
  const id = normalizeGroupId(groupId);
  return normalizeGroupId(groupLabel) === id;
}

/** Colores distintivos por grupo — estilo álbum mundialista. */
export const GROUP_COLORS: Record<string, string> = {
  A: '#0057B8',
  B: '#006B3F',
  C: '#E63946',
  D: '#D4AF37',
  E: '#0E8A4A',
  F: '#7B2CBF',
  G: '#F8B91E',
  H: '#004B9B',
  I: '#C92A36',
  J: '#1FA971',
  K: '#FF6B3D',
  L: '#003D25',
};

export function groupColor(groupId: string): string {
  return GROUP_COLORS[normalizeGroupId(groupId)] ?? '#006B3F';
}
