/** Sprint V2 — scoring de identidad de jugadores (más estricto que V1) */
import { nationalitiesMatch } from '../../providers/enrichment/playerMatch';
import { compareNames, isGenericName, normalizeCountryName } from '../../utils/playerIdentityNormalizer';
import type { ExternalPlayerCandidate } from './playerMatching';

export type IdentityVerification = 'verified' | 'needs_review' | 'possible_match' | 'rejected';

export interface LocalIdentityInput {
  name: string;
  date_of_birth?: string | null;
  nationality?: string | null;
  country?: string | null;
  position?: string | null;
  club?: string | null;
  age?: number | null;
}

export interface IdentityMatchResult {
  candidate: ExternalPlayerCandidate;
  score: number;
  verification: IdentityVerification;
  matchedFields: string[];
  conflictedFields: string[];
  reasons: string[];
}

export const IDENTITY_THRESHOLDS = {
  verified: 80,
  needsReview: 60,
  possibleMatch: 50,
} as const;

function sameDate(a?: string | null, b?: string | null): boolean | null {
  if (!a || !b) return null;
  return a.slice(0, 10) === b.slice(0, 10);
}

function positionsCompatible(a?: string | null, b?: string | null): boolean | null {
  if (!a || !b) return null;
  const groups = [
    ['goal', 'keeper', 'gk', 'arq'],
    ['def', 'back', 'cb', 'lb', 'rb', 'defen'],
    ['mid', 'cm', 'cdm', 'cam', 'medio'],
    ['wing', 'forward', 'strik', 'off', 'delan', 'fw', 'st'],
  ];
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  return groups.some(g => g.some(x => na.includes(x)) && g.some(x => nb.includes(x)));
}

export function verificationFromScore(score: number): IdentityVerification {
  if (score >= IDENTITY_THRESHOLDS.verified) return 'verified';
  if (score >= IDENTITY_THRESHOLDS.needsReview) return 'needs_review';
  if (score >= IDENTITY_THRESHOLDS.possibleMatch) return 'possible_match';
  return 'rejected';
}

export function matchPlayerIdentity(
  local: LocalIdentityInput,
  candidate: ExternalPlayerCandidate,
): IdentityMatchResult {
  let score = 0;
  const reasons: string[] = [];
  const matchedFields: string[] = [];
  const conflictedFields: string[] = [];

  // Nombre
  const nameCmp = compareNames(local.name, candidate.name);
  if (nameCmp === 'exact') {
    score += 35;
    matchedFields.push('name');
    reasons.push('+35 nombre exacto');
  } else if (nameCmp === 'strong') {
    score += 25;
    matchedFields.push('name');
    reasons.push('+25 nombre parcial fuerte');
  } else if (nameCmp === 'weak' || isGenericName(candidate.name)) {
    score -= 20;
    reasons.push('-20 nombre débil/genérico');
  }

  // Fecha de nacimiento
  const dob = sameDate(local.date_of_birth, candidate.birthDate);
  if (dob === true) {
    score += 30;
    matchedFields.push('date_of_birth');
    reasons.push('+30 fecha nacimiento exacta');
  } else if (dob === false) {
    score -= 50;
    conflictedFields.push('date_of_birth');
    reasons.push('-50 conflicto fecha nacimiento');
  } else if (!local.date_of_birth && candidate.birthDate && (nameCmp === 'exact' || nameCmp === 'strong')) {
    score += 20;
    matchedFields.push('date_of_birth_from_provider');
    reasons.push('+20 fecha en fuente (local vacía, nombre fuerte)');
  }

  // Nacionalidad
  if (local.nationality && candidate.nationality) {
    if (nationalitiesMatch(local.nationality, candidate.nationality)) {
      score += 20;
      matchedFields.push('nationality');
      reasons.push('+20 nacionalidad exacta');
    } else {
      score -= 40;
      conflictedFields.push('nationality');
      reasons.push('-40 conflicto nacionalidad');
    }
  }

  // País / selección
  if (local.country && candidate.nationality) {
    if (normalizeCountryName(local.country) === normalizeCountryName(candidate.nationality)) {
      score += 20;
      matchedFields.push('country');
      reasons.push('+20 selección exacta');
    }
  }

  // Posición
  const posOk = positionsCompatible(local.position, candidate.position ?? candidate.detailedPosition);
  if (posOk === true) {
    score += 10;
    matchedFields.push('position');
    reasons.push('+10 posición compatible');
  }

  // Club
  if (local.club && candidate.club) {
    const lc = normalizeCountryName(local.club);
    const cc = normalizeCountryName(candidate.club);
    if (lc === cc || lc.includes(cc) || cc.includes(lc)) {
      score += 10;
      matchedFields.push('club');
      reasons.push('+10 club compatible');
    }
  }

  // Edad aproximada (si no hubo fecha exacta)
  if (dob !== true && local.age != null && candidate.birthDate) {
    const candAge = new Date().getFullYear() - new Date(candidate.birthDate).getFullYear();
    if (Math.abs(candAge - local.age) <= 1) {
      score += 5;
      reasons.push('+5 edad aproximada');
    }
  }

  return {
    candidate,
    score,
    verification: verificationFromScore(score),
    matchedFields,
    conflictedFields,
    reasons,
  };
}

export function bestIdentityMatch(
  local: LocalIdentityInput,
  candidates: ExternalPlayerCandidate[],
): IdentityMatchResult | null {
  if (candidates.length === 0) return null;
  const scored = candidates.map(c => matchPlayerIdentity(local, c));
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}
