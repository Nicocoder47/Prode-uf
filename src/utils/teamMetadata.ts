import { lookupCountryReference, normalizeConfederation } from '../services/footballData/providers/countryReference';

/** Confederación a partir de nombre/código/país devueltos por la API (referencia FIFA, no inventada). */
export function resolveTeamConfederation(
  name?: string | null,
  code?: string | null,
  country?: string | null,
): string | null {
  for (const value of [name, code, country]) {
    if (!value?.trim()) continue;
    const ref = lookupCountryReference(value.trim());
    if (ref?.confederation) return ref.confederation;
  }
  if (country?.trim()) {
    const normalized = normalizeConfederation(country);
    return normalized || null;
  }
  return null;
}

export type TeamMetadataPatch = {
  coach?: string | null;
  confederation?: string | null;
  fifa_ranking?: number | null;
};

/** Solo rellena campos vacíos; no pisa datos ya verificados en BD. */
export function mergeTeamMetadata(
  existing: { coach?: string | null; confederation?: string | null; fifa_ranking?: number | null },
  patch: TeamMetadataPatch,
): TeamMetadataPatch {
  const out: TeamMetadataPatch = {};
  if (!existing.coach?.trim() && patch.coach?.trim()) out.coach = patch.coach.trim();
  if (!existing.confederation?.trim() && patch.confederation?.trim()) {
    out.confederation = patch.confederation.trim();
  }
  if (existing.fifa_ranking == null && patch.fifa_ranking != null && patch.fifa_ranking > 0) {
    out.fifa_ranking = patch.fifa_ranking;
  }
  return out;
}

export function formatCoachName(coach: {
  name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
}): string | null {
  const full = [coach.firstname, coach.lastname].filter(Boolean).join(' ').trim();
  if (full.length >= 3) return full;
  const short = coach.name?.trim();
  return short && short.length >= 2 ? short : null;
}
