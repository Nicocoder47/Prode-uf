/** Player Data Quality Sprint V1 — score, auditoría y helpers */

export type PlayerAuditRow = {
  id: string;
  name: string;
  team_id: string;
  provider: string | null;
  provider_player_id: string | null;
  photo_url: string | null;
  club: string | null;
  shirt_number: number | null;
  height: number | null;
  preferred_foot: string | null;
  market_value: number | null;
  market_value_eur: number | null;
  rating: number | null;
  date_of_birth: string | null;
  nationality: string | null;
  position: string | null;
  data_quality_score: number | null;
  enrichment_status: string | null;
  data_sources: Record<string, string> | null;
};

export const QUALITY_FIELDS = [
  { key: 'photo_url', label: 'photo_url', weight: 20 },
  { key: 'club', label: 'club', weight: 15 },
  { key: 'shirt_number', label: 'shirt_number', weight: 10 },
  { key: 'height', label: 'height', weight: 10 },
  { key: 'preferred_foot', label: 'preferred_foot', weight: 10 },
  { key: 'market_value', label: 'market_value', weight: 15 },
  { key: 'date_of_birth', label: 'birth_date', weight: 10 },
  { key: 'nationality', label: 'nationality', weight: 5 },
  { key: 'position', label: 'position', weight: 5 },
] as const;

export function isFieldPresent(row: Record<string, unknown>, key: string): boolean {
  const v = row[key];
  if (v == null || v === '') return false;
  if (typeof v === 'number' && v === 0 && key !== 'shirt_number') return false;
  return true;
}

export function calculatePlayerDataQuality(player: Record<string, unknown>): number {
  let score = 0;
  for (const f of QUALITY_FIELDS) {
    if (isFieldPresent(player, f.key)) score += f.weight;
  }
  if (!isFieldPresent(player, 'market_value') && isFieldPresent(player, 'market_value_eur')) {
    score += 15;
  }
  return Math.min(100, score);
}

export function countMissingFields(player: Record<string, unknown>): number {
  return QUALITY_FIELDS.filter(f => !isFieldPresent(player, f.key)).length;
}

export function fieldCoverage(rows: Record<string, unknown>[]) {
  const total = rows.length || 1;
  return QUALITY_FIELDS.map(f => {
    const filled = rows.filter(r => isFieldPresent(r, f.key)).length;
    return {
      field: f.label,
      dbKey: f.key,
      count: filled,
      pct: Math.round((filled / total) * 1000) / 10,
    };
  });
}

export function normalizePlayerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findDuplicateNameGroups(rows: { id: string; name: string; team_id: string }[]) {
  const map = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = normalizePlayerName(r.name);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([name, players]) => ({ name, count: players.length, players }));
}

export function playersWithoutExternalId(rows: PlayerAuditRow[]) {
  return rows.filter(
    r => !r.provider_player_id || r.provider_player_id.trim() === '' || !r.provider,
  );
}

export function teamQualitySummary(rows: PlayerAuditRow[], teamNames: Map<string, string>) {
  const byTeam = new Map<string, PlayerAuditRow[]>();
  for (const r of rows) {
    if (!byTeam.has(r.team_id)) byTeam.set(r.team_id, []);
    byTeam.get(r.team_id)!.push(r);
  }

  return [...byTeam.entries()]
    .map(([teamId, list]) => {
      const avg =
        list.reduce((s, p) => s + (p.data_quality_score ?? calculatePlayerDataQuality(p)), 0) /
        (list.length || 1);
      return {
        teamId,
        teamName: teamNames.get(teamId) ?? teamId,
        players: list.length,
        avgQuality: Math.round(avg),
        incomplete: list.filter(p => (p.data_quality_score ?? 0) < 80).length,
      };
    })
    .sort((a, b) => a.avgQuality - b.avgQuality);
}

export function topIncompletePlayers(rows: PlayerAuditRow[], limit = 50) {
  return [...rows]
    .map(r => ({
      ...r,
      missing: countMissingFields(r),
      score: r.data_quality_score ?? calculatePlayerDataQuality(r),
    }))
    .sort((a, b) => b.missing - a.missing || a.score - b.score)
    .slice(0, limit);
}

export const PLAYER_AUDIT_SELECT =
  'id,name,team_id,provider,provider_player_id,photo_url,club,shirt_number,height,preferred_foot,market_value,market_value_eur,rating,date_of_birth,nationality,position,data_quality_score,enrichment_status,data_sources';

/** Sprint V2 — select extendido con campos de identidad/verificación. */
export const PLAYER_TRACE_SELECT = `${PLAYER_AUDIT_SELECT},api_football_id,sportmonks_id,transfermarkt_id,wikidata_id,thesportsdb_id,verification_status,identity_confidence_score,verified_fields,conflicted_fields,last_verified_at,identity_key,identity_candidate`;

export type PlayerTraceRow = PlayerAuditRow & {
  api_football_id: string | null;
  sportmonks_id: string | null;
  transfermarkt_id: string | null;
  wikidata_id: string | null;
  thesportsdb_id: string | null;
  verification_status: string | null;
  identity_confidence_score: number | null;
  verified_fields: string[] | null;
  conflicted_fields: string[] | null;
  last_verified_at: string | null;
  identity_key: string | null;
};

export function hasReliableExternalId(p: Partial<PlayerTraceRow>): boolean {
  return !!(p.api_football_id || p.sportmonks_id || p.transfermarkt_id || p.wikidata_id || p.thesportsdb_id);
}

/** traceability_score: external_id + data_sources + verificación + ausencia de conflictos. */
export function computeTraceabilityScore(p: Partial<PlayerTraceRow>): number {
  let score = 0;
  if (hasReliableExternalId(p)) score += 30;

  const sources = p.data_sources ?? {};
  const sourcedFields = Object.keys(sources).length;
  score += Math.min(25, sourcedFields * 4);

  if (p.verification_status === 'verified') score += 25;
  else if (p.verification_status === 'needs_review') score += 10;

  if (p.last_verified_at) score += 10;

  const conflicts = p.conflicted_fields ?? [];
  if (conflicts.length === 0) score += 10;
  else score -= Math.min(20, conflicts.length * 5);

  return Math.max(0, Math.min(100, score));
}

export function identityKeyDuplicates(rows: { id: string; name: string; identity_key: string | null }[]) {
  const map = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.identity_key) continue;
    if (!map.has(r.identity_key)) map.set(r.identity_key, []);
    map.get(r.identity_key)!.push(r);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, players]) => ({ key, count: players.length, players }));
}
