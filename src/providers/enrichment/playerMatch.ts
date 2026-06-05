const NATIONALITY_ALIASES: Record<string, string[]> = {
  czechia: ['czech republic', 'czechia', 'cze'],
  'czech republic': ['czech republic', 'czechia', 'cze'],
  'united states': ['usa', 'united states', 'united states of america', 'us'],
  usa: ['usa', 'united states', 'united states of america', 'us'],
  'korea republic': ['korea republic', 'south korea', 'republic of korea', 'kor'],
  'south korea': ['korea republic', 'south korea', 'republic of korea', 'kor'],
  'bosnia-herzegovina': ['bosnia-herzegovina', 'bosnia and herzegovina', 'bih'],
  'ivory coast': ['ivory coast', "cote d'ivoire", "côte d'ivoire", 'civ'],
  'cape verde': ['cape verde', 'cabo verde', 'cpv'],
};

export function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nationalityTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  const base = normalizeToken(value);
  const aliases = NATIONALITY_ALIASES[base] ?? [base];
  return [...new Set(aliases.map(normalizeToken))];
}

export function nationalitiesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return true;
  const ta = nationalityTokens(a);
  const tb = nationalityTokens(b);
  return ta.some(x => tb.some(y => x === y || x.includes(y) || y.includes(x)));
}

export function normalizeName(value: string): string {
  return normalizeToken(value);
}

export function namesMatch(candidate: string, target: string): boolean {
  const a = normalizeName(candidate);
  const b = normalizeName(target);
  if (a === b) return true;

  const aParts = a.split(' ');
  const bParts = b.split(' ');
  if (aParts.length === 0 || bParts.length === 0) return false;

  const aLast = aParts[aParts.length - 1];
  const bLast = bParts[bParts.length - 1];
  if (aLast !== bLast) return false;

  return aParts[0][0] === bParts[0][0];
}

export function parseHeightCm(raw: unknown): number | null {
  if (typeof raw === 'number' && raw > 0) {
    return raw > 3 ? Math.round(raw) : Math.round(raw * 100);
  }
  if (typeof raw !== 'string') return null;

  const meters = raw.match(/(\d+[.,]\d+)\s*m/i);
  if (meters) {
    const n = Number(meters[1].replace(',', '.'));
    if (n > 1 && n < 2.5) return Math.round(n * 100);
  }

  const cm = raw.match(/(\d{2,3})\s*cm/i);
  if (cm) return Number(cm[1]);

  const plain = raw.match(/\b(\d{3})\b/);
  if (plain) {
    const n = Number(plain[1]);
    if (n >= 150 && n <= 220) return n;
  }

  return null;
}

export function parsePreferredFoot(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const v = raw.toLowerCase();
  if (v === 'left' || v.includes('left')) return 'Izquierdo';
  if (v === 'right' || v.includes('right')) return 'Derecho';
  if (v.includes('both')) return 'Ambidiestro';
  return null;
}

export function parseMarketValueFromSigning(raw: unknown): number | null {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/€?\s*([\d,.]+)\s*([mkMK])?/);
  if (!m) return null;
  let n = Number(m[1].replace(',', '.'));
  const suffix = (m[2] ?? '').toLowerCase();
  if (suffix === 'm') n *= 1_000_000;
  if (suffix === 'k') n *= 1_000;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function parseShirtNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && raw > 0 && raw < 100) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw.trim());
    if (Number.isFinite(n) && n > 0 && n < 100) return n;
  }
  return null;
}

export function parseRating(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number(n.toFixed(2));
}

export function parseMarketValueEur(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}
