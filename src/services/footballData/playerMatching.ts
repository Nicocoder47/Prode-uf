import { nationalitiesMatch, normalizeName, normalizeToken } from '../../providers/enrichment/playerMatch';

export interface LocalPlayerMatchInput {
  name: string;
  date_of_birth?: string | null;
  nationality?: string | null;
  position?: string | null;
  club?: string | null;
}

export interface ExternalPlayerCandidate {
  source: string;
  externalId?: string | null;
  name: string;
  birthDate?: string | null;
  nationality?: string | null;
  position?: string | null;
  detailedPosition?: string | null;
  club?: string | null;
  shirtNumber?: number | null;
  height?: number | null;
  weight?: number | null;
  preferredFoot?: string | null;
  marketValue?: number | null;
  rating?: number | null;
  photoUrl?: string | null;
  birthPlace?: string | null;
}

export interface MatchResult {
  candidate: ExternalPlayerCandidate;
  score: number;
  reasons: string[];
}

const MIN_AUTO = Number(process.env.PLAYER_ENRICH_MIN_SCORE || 75);
const MIN_REVIEW = 50;

function sameDate(a?: string | null, b?: string | null): boolean | null {
  if (!a || !b) return null;
  return a.slice(0, 10) === b.slice(0, 10);
}

function positionsCompatible(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return true;
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (na === nb) return true;
  const groups = [
    ['goal', 'keeper', 'gk'],
    ['def', 'back', 'cb', 'lb', 'rb'],
    ['mid', 'cm', 'cdm', 'cam'],
    ['wing', 'forward', 'strik', 'off'],
  ];
  return groups.some(g => g.some(x => na.includes(x)) && g.some(x => nb.includes(x)));
}

export function matchPlayerCandidate(
  local: LocalPlayerMatchInput,
  candidates: ExternalPlayerCandidate[],
): MatchResult | null {
  if (candidates.length === 0) return null;

  const scored = candidates.map(candidate => {
    let score = 0;
    const reasons: string[] = [];

    const localNorm = normalizeName(local.name);
    const candNorm = normalizeName(candidate.name);

    if (localNorm === candNorm) {
      score += 40;
      reasons.push('+40 nombre exacto');
    } else if (localNorm.split(' ').slice(-1)[0] === candNorm.split(' ').slice(-1)[0]) {
      score += 15;
      reasons.push('+15 apellido coincide');
    } else {
      score -= 20;
      reasons.push('-20 nombre dudoso');
    }

    const dob = sameDate(local.date_of_birth, candidate.birthDate);
    if (dob === true) {
      score += 25;
      reasons.push('+25 fecha nacimiento');
    } else if (dob === false) {
      score -= 30;
      reasons.push('-30 fecha distinta');
    }

    if (nationalitiesMatch(local.nationality, candidate.nationality)) {
      if (local.nationality && candidate.nationality) {
        score += 20;
        reasons.push('+20 nacionalidad');
      }
    } else {
      score -= 30;
      reasons.push('-30 nacionalidad distinta');
    }

    if (positionsCompatible(local.position, candidate.position ?? candidate.detailedPosition)) {
      if (local.position && (candidate.position || candidate.detailedPosition)) {
        score += 15;
        reasons.push('+15 posición compatible');
      }
    }

    if (local.club && candidate.club) {
      const lc = normalizeToken(local.club);
      const cc = normalizeToken(candidate.club);
      if (lc === cc || lc.includes(cc) || cc.includes(lc)) {
        score += 10;
        reasons.push('+10 club coincide');
      }
    }

    return { candidate, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0] ?? null;
}

export function resolveEnrichmentStatus(score: number): 'enriched' | 'needs_review' | 'rejected' {
  if (score >= MIN_AUTO) return 'enriched';
  if (score >= MIN_REVIEW) return 'needs_review';
  return 'rejected';
}

export { MIN_AUTO, MIN_REVIEW };
