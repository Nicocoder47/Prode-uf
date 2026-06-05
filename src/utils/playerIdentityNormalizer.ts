/** Sprint V2 — normalización de identidad de jugadores y países */

export function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '');
}

export function normalizePlayerName(name: string): string {
  return removeAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Lionel Andrés Messi Cuccittini" → "l messi" (inicial + apellido) */
export function normalizeShortName(name: string): string {
  const norm = normalizePlayerName(name);
  const parts = norm.split(' ').filter(Boolean);
  if (parts.length <= 1) return norm;
  const first = parts[0][0];
  const last = parts[parts.length - 1];
  return `${first} ${last}`;
}

const COUNTRY_ALIASES: Record<string, string> = {
  'czech republic': 'czechia',
  cze: 'czechia',
  'united states of america': 'usa',
  'united states': 'usa',
  us: 'usa',
  'south korea': 'korea republic',
  'republic of korea': 'korea republic',
  kor: 'korea republic',
  'bosnia and herzegovina': 'bosnia-herzegovina',
  bih: 'bosnia-herzegovina',
  "cote d'ivoire": 'ivory coast',
  "côte d'ivoire": 'ivory coast',
  civ: 'ivory coast',
  'cabo verde': 'cape verde',
  cpv: 'cape verde',
  'ir iran': 'iran',
  'iran islamic republic of': 'iran',
};

export function normalizeCountryName(country: string): string {
  const base = removeAccents(country)
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return COUNTRY_ALIASES[base] ?? base;
}

export interface IdentityKeyInput {
  name: string;
  nationality?: string | null;
  date_of_birth?: string | null;
  position?: string | null;
  team?: string | null;
}

/** Clave determinística para deduplicación / matching local. */
export function generatePlayerIdentityKey(player: IdentityKeyInput): string {
  const parts = [
    normalizeShortName(player.name),
    player.nationality ? normalizeCountryName(player.nationality) : '',
    player.date_of_birth ? player.date_of_birth.slice(0, 10) : '',
    player.position ? normalizePlayerName(player.position).slice(0, 3) : '',
    player.team ? normalizeCountryName(player.team) : '',
  ];
  return parts.filter(Boolean).join('|');
}

/** Compara dos nombres devolviendo tipo de coincidencia. */
export function compareNames(a: string, b: string): 'exact' | 'strong' | 'weak' | 'none' {
  const na = normalizePlayerName(a);
  const nb = normalizePlayerName(b);
  if (na === nb) return 'exact';

  const pa = na.split(' ').filter(Boolean);
  const pb = nb.split(' ').filter(Boolean);
  if (pa.length === 0 || pb.length === 0) return 'none';

  const lastA = pa[pa.length - 1];
  const lastB = pb[pb.length - 1];

  if (lastA === lastB) {
    if (pa[0][0] === pb[0][0]) return 'strong';
    return 'weak';
  }
  return 'none';
}

/** Nombre genérico/débil (muy corto o demasiado común). */
export function isGenericName(name: string): boolean {
  const norm = normalizePlayerName(name);
  const parts = norm.split(' ').filter(Boolean);
  return norm.length < 4 || parts.every(p => p.length < 3);
}
