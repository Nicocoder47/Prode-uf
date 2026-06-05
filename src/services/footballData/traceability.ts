/** Sprint V2 — trazabilidad por campo: source, fetched_at, confidence */

export interface FieldSource {
  source: string;
  providerId?: string | null;
  fetchedAt: string;
  confidence: number;
  verificationStatus: 'verified' | 'needs_review' | 'conflict' | 'possible_match' | 'rejected';
}

export type DataSources = Record<string, FieldSource | string>;

export function makeFieldSource(
  source: string,
  confidence: number,
  verificationStatus: FieldSource['verificationStatus'],
  providerId?: string | null,
): FieldSource {
  return {
    source,
    providerId: providerId ?? null,
    fetchedAt: new Date().toISOString(),
    confidence,
    verificationStatus,
  };
}

/** Normaliza el formato heredado (string) al objeto trazable. */
export function normalizeFieldSource(value: FieldSource | string | undefined): FieldSource | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    return {
      source: value,
      providerId: null,
      fetchedAt: '',
      confidence: 50,
      verificationStatus: 'needs_review',
    };
  }
  return value;
}

export function hasTraceableSource(value: FieldSource | string | undefined): boolean {
  const fs = normalizeFieldSource(value);
  return !!fs && !!fs.source;
}

/** Prioridad de fuentes — mayor número gana ante conflicto. */
export const SOURCE_PRIORITY: Record<string, number> = {
  'api-football': 90,
  sportmonks: 85,
  transfermarkt: 80,
  wikidata: 70,
  thesportsdb: 50,
  wikimedia: 40,
  'football-data': 30,
  manual: 100,
};

export function sourcePriority(source: string): number {
  return SOURCE_PRIORITY[source] ?? 10;
}

export function shouldOverride(existing: FieldSource | string | undefined, incomingSource: string): boolean {
  const fs = normalizeFieldSource(existing);
  if (!fs) return true;
  if (fs.verificationStatus === 'verified' && sourcePriority(incomingSource) <= sourcePriority(fs.source)) {
    return false;
  }
  return sourcePriority(incomingSource) >= sourcePriority(fs.source);
}
