import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { supabase } from '../../database/supabaseClient';
import { calculatePlayerDataQuality } from './playerDataQuality';
import {
  matchPlayerCandidate,
  resolveEnrichmentStatus,
  type ExternalPlayerCandidate,
} from './playerMatching';
import { ApiFootballPlayerProvider } from './providers/ApiFootballPlayerProvider';
import { SportmonksPlayerProvider } from './providers/SportmonksPlayerProvider';
import { TheSportsDbPlayerProvider } from './providers/TheSportsDbPlayerProvider';
import { TransfermarktPlayerProvider } from './providers/TransfermarktPlayerProvider';
import { WikimediaPlayerProvider } from './providers/WikimediaPlayerProvider';

/**
 * Enriquecimiento V1 (legacy) — solo campos no sensibles si identity no está verificada.
 * Flujo recomendado Sprint V2: npm run enrich:players:verified (verifiedEnrichmentService.ts)
 * tras link:players:identities con verification_status = verified.
 */

const PLAYER_SELECT =
  'id,name,team_id,nationality,position,club,date_of_birth,provider,provider_player_id,shirt_number,height,weight,preferred_foot,market_value,market_value_eur,rating,photo_url,birth_place,detailed_position,api_football_id,sportmonks_id,transfermarkt_id,wikidata_id,thesportsdb_id,data_quality_score,data_sources,enrichment_status,verification_status';

/** Campos sensibles — Sprint V2: solo con verification_status = verified. */
const SENSITIVE_ENRICH_FIELDS = new Set([
  'photo_url',
  'club',
  'market_value',
  'market_value_eur',
  'preferred_foot',
  'height',
  'weight',
  'birth_place',
  'api_football_id',
  'sportmonks_id',
  'transfermarkt_id',
  'wikidata_id',
  'thesportsdb_id',
]);

const SKIP_REASON_NOT_VERIFIED =
  'identity_not_verified: campos sensibles bloqueados — usar npm run enrich:players:verified tras vincular identidad';

const PROGRESS_PATH = 'reports/enrich-progress.json';

export type DbPlayerEnrichRow = Record<string, unknown> & {
  id: string;
  name: string;
  team_id: string;
  nationality: string | null;
  position: string | null;
  club: string | null;
  date_of_birth: string | null;
  provider: string | null;
  provider_player_id: string | null;
  data_sources: Record<string, string> | null;
  verification_status?: string | null;
};

export interface EnrichOptions {
  limit?: number;
  teamId?: string;
  playerId?: string;
  onlyMissingPhotos?: boolean;
  onlyMissingMarketValues?: boolean;
  resume?: boolean;
  delayMs?: number;
  batchSize?: number;
  maxPerRun?: number;
}

export interface EnrichRunResult {
  scanned: number;
  updated: number;
  needsReview: number;
  rejected: number;
  skipped: number;
  errors: number;
}

function isIdentityVerified(player: DbPlayerEnrichRow): boolean {
  return player.verification_status === 'verified';
}

function stripSensitiveFields(patch: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!SENSITIVE_ENRICH_FIELDS.has(key)) safe[key] = value;
  }
  return safe;
}

function isBlank(value: unknown): boolean {
  return value == null || value === '' || value === 0;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function loadProgress(): { lastPlayerId?: string } {
  if (!existsSync(PROGRESS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(PROGRESS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveProgress(data: Record<string, unknown>) {
  mkdirSync('reports', { recursive: true });
  writeFileSync(PROGRESS_PATH, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2));
}

async function gatherCandidates(player: DbPlayerEnrichRow): Promise<ExternalPlayerCandidate[]> {
  const all: ExternalPlayerCandidate[] = [];

  if (ApiFootballPlayerProvider.isConfigured()) {
    all.push(...(await ApiFootballPlayerProvider.searchCandidates(player.name, player.nationality)));
  }

  all.push(...(await SportmonksPlayerProvider.searchCandidates(player.name, player.nationality)));
  all.push(...(await TheSportsDbPlayerProvider.searchCandidates(player.name, player.nationality)));
  all.push(...(await WikimediaPlayerProvider.searchCandidates(player.name, player.nationality)));

  if (TransfermarktPlayerProvider.isConfigured() && player.provider_player_id) {
    const tm = await TransfermarktPlayerProvider.lookupByProviderId(String(player.provider_player_id));
    if (tm) all.push(tm);
  }

  return all;
}

function buildPatchFromCandidate(
  player: DbPlayerEnrichRow,
  candidate: ExternalPlayerCandidate,
  sources: Record<string, string>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const src = candidate.source;

  if (isBlank(player.shirt_number) && candidate.shirtNumber != null) {
    patch.shirt_number = candidate.shirtNumber;
    sources.shirt_number = src;
  }
  if (isBlank(player.height) && candidate.height != null) {
    patch.height = candidate.height;
    sources.height = src;
  }
  if (isBlank(player.weight) && candidate.weight != null) {
    patch.weight = candidate.weight;
    sources.weight = src;
  }
  if (isBlank(player.preferred_foot) && candidate.preferredFoot) {
    patch.preferred_foot = candidate.preferredFoot;
    sources.preferred_foot = src;
  }
  if (isBlank(player.club) && candidate.club) {
    patch.club = candidate.club;
    sources.club = src;
  }
  if (isBlank(player.market_value) && candidate.marketValue != null) {
    patch.market_value = candidate.marketValue;
    patch.market_value_eur = candidate.marketValue;
    sources.market_value = src;
  }
  if (isBlank(player.rating) && candidate.rating != null) {
    patch.rating = candidate.rating;
    sources.rating = src;
  }
  if (isBlank(player.photo_url) && candidate.photoUrl) {
    patch.photo_url = candidate.photoUrl;
    sources.photo_url = src;
  }
  if (isBlank(player.date_of_birth) && candidate.birthDate) {
    patch.date_of_birth = candidate.birthDate.slice(0, 10);
    sources.date_of_birth = src;
  }
  if (isBlank(player.nationality) && candidate.nationality) {
    patch.nationality = candidate.nationality;
    sources.nationality = src;
  }
  if (isBlank(player.position) && candidate.position) {
    patch.position = candidate.position;
    sources.position = src;
  }
  if (isBlank(player.detailed_position) && candidate.detailedPosition) {
    patch.detailed_position = candidate.detailedPosition;
    sources.detailed_position = src;
  }
  if (isBlank(player.birth_place) && candidate.birthPlace) {
    patch.birth_place = candidate.birthPlace;
    sources.birth_place = src;
  }

  if (candidate.externalId) {
    if (src === 'api-football' && isBlank(player.api_football_id)) patch.api_football_id = candidate.externalId;
    if (src === 'sportmonks' && isBlank(player.sportmonks_id)) patch.sportmonks_id = candidate.externalId;
    if (src === 'transfermarkt' && isBlank(player.transfermarkt_id)) patch.transfermarkt_id = candidate.externalId;
    if (src === 'thesportsdb' && isBlank(player.thesportsdb_id)) patch.thesportsdb_id = candidate.externalId;
  }

  return patch;
}

export async function enrichSinglePlayer(playerId: string): Promise<{ ok: boolean; status: string; score?: number }> {
  const { data, error } = await supabase.from('players').select(PLAYER_SELECT).eq('id', playerId).maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 'not_found' };

  const result = await processPlayer(data as DbPlayerEnrichRow, Number(process.env.PLAYER_ENRICH_DELAY_MS || 800));
  return { ok: result.updated, status: result.status, score: result.matchScore };
}

async function processPlayer(
  player: DbPlayerEnrichRow,
  delayMs: number,
): Promise<{ updated: boolean; status: string; matchScore?: number }> {
  try {
    const candidates = await gatherCandidates(player);
    const match = matchPlayerCandidate(
      {
        name: player.name,
        date_of_birth: player.date_of_birth as string | null,
        nationality: player.nationality,
        position: player.position,
        club: player.club,
      },
      candidates,
    );

    if (!match || match.score < 50) {
      await supabase
        .from('players')
        .update({
          enrichment_status: 'rejected',
          enrichment_error: match ? `score=${match.score}` : 'no_candidates',
          last_enriched_at: new Date().toISOString(),
        })
        .eq('id', player.id);
      return { updated: false, status: 'rejected', matchScore: match?.score };
    }

    const status = resolveEnrichmentStatus(match.score);
    const sources: Record<string, string> = { ...(player.data_sources ?? {}) };
    const fullPatch = buildPatchFromCandidate(player, match.candidate, sources);
    const verified = isIdentityVerified(player);
    const patch = verified ? fullPatch : stripSensitiveFields(fullPatch);

    if (!verified) {
      for (const key of SENSITIVE_ENRICH_FIELDS) {
        delete sources[key];
        if (key === 'market_value') delete sources.market_value_eur;
      }
    }

    if (!verified && Object.keys(fullPatch).length > 0 && Object.keys(patch).length === 0) {
      await supabase
        .from('players')
        .update({
          enrichment_status: 'skipped',
          enrichment_error: SKIP_REASON_NOT_VERIFIED,
          last_enriched_at: new Date().toISOString(),
        })
        .eq('id', player.id);
      return { updated: false, status: 'skipped', matchScore: match.score };
    }

    if (status === 'needs_review') {
      await supabase
        .from('players')
        .update({
          enrichment_status: 'needs_review',
          enrichment_error: `score=${match.score}`,
          last_enriched_at: new Date().toISOString(),
        })
        .eq('id', player.id);
      return { updated: false, status: 'needs_review', matchScore: match.score };
    }

    if (Object.keys(patch).length === 0) {
      await supabase
        .from('players')
        .update({
          data_quality_score: calculatePlayerDataQuality(player),
          enrichment_status: 'enriched',
          enrichment_error: null,
          last_enriched_at: new Date().toISOString(),
        })
        .eq('id', player.id);
      return { updated: false, status: 'skipped', matchScore: match.score };
    }

    const merged = { ...player, ...patch };
    patch.data_quality_score = calculatePlayerDataQuality(merged);
    patch.data_sources = sources;
    patch.enrichment_status = 'enriched';
    patch.enrichment_error = null;
    patch.last_enriched_at = new Date().toISOString();
    patch.updated_at = new Date().toISOString();

    const { error: patchErr } = await supabase.from('players').update(patch).eq('id', player.id);
    if (patchErr) throw patchErr;

    if (delayMs > 0) await sleep(delayMs);
    return { updated: true, status: 'enriched', matchScore: match.score };
  } catch (err) {
    await supabase
      .from('players')
      .update({
        enrichment_status: 'error',
        enrichment_error: err instanceof Error ? err.message : String(err),
        last_enriched_at: new Date().toISOString(),
      })
      .eq('id', player.id);
    throw err;
  }
}

export async function enrichPlayersBatch(options: EnrichOptions = {}): Promise<EnrichRunResult> {
  const batchSize = options.batchSize ?? Number(process.env.PLAYER_ENRICH_BATCH_SIZE || 25);
  const maxPerRun = options.maxPerRun ?? Number(process.env.PLAYER_ENRICH_MAX_PER_RUN || 200);
  const delayMs = options.delayMs ?? Number(process.env.PLAYER_ENRICH_DELAY_MS || 800);
  const limit = Math.min(options.limit ?? maxPerRun, maxPerRun);

  let query = supabase
    .from('players')
    .select(PLAYER_SELECT)
    .order('data_quality_score', { ascending: true })
    .order('name');

  if (options.teamId) query = query.eq('team_id', options.teamId);
  if (options.playerId) query = query.eq('id', options.playerId);
  if (options.onlyMissingPhotos) query = query.is('photo_url', null);
  if (options.onlyMissingMarketValues) query = query.is('market_value', null);

  if (!options.playerId) {
    query = query.or('enrichment_status.eq.pending,enrichment_status.eq.error,data_quality_score.lt.80');
  }

  const progress = options.resume ? loadProgress() : {};
  if (progress.lastPlayerId && options.resume) {
    query = query.gt('id', progress.lastPlayerId);
  }

  const { data, error } = await query.limit(limit);
  if (error) throw error;

  const players = (data ?? []) as DbPlayerEnrichRow[];
  const result: EnrichRunResult = {
    scanned: 0,
    updated: 0,
    needsReview: 0,
    rejected: 0,
    skipped: 0,
    errors: 0,
  };

  for (let i = 0; i < players.length; i += batchSize) {
    const chunk = players.slice(i, i + batchSize);
    for (const player of chunk) {
      result.scanned++;
      try {
        const r = await processPlayer(player, delayMs);
        if (r.updated) result.updated++;
        else if (r.status === 'needs_review') result.needsReview++;
        else if (r.status === 'rejected') result.rejected++;
        else result.skipped++;

        saveProgress({ lastPlayerId: player.id, ...result });
      } catch {
        result.errors++;
      }
    }
  }

  return result;
}

export async function recalculateAllQualityScores(): Promise<number> {
  const { data, error } = await supabase.from('players').select(PLAYER_SELECT);
  if (error) throw error;

  let updated = 0;
  for (const row of data ?? []) {
    const score = calculatePlayerDataQuality(row as Record<string, unknown>);
    const current = (row as { data_quality_score?: number }).data_quality_score ?? 0;
    if (current !== score) {
      await supabase.from('players').update({ data_quality_score: score }).eq('id', (row as { id: string }).id);
      updated++;
    }
  }
  return updated;
}

export { enrichVerifiedPlayers } from './verifiedEnrichmentService';

export default { enrichPlayersBatch, enrichSinglePlayer, recalculateAllQualityScores };
