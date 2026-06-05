/** Sprint V2 — Fase 5: enriquecimiento real solo de jugadores con identidad verificada */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { supabase } from '../../database/supabaseClient';
import { calculatePlayerDataQuality } from './playerDataQuality';
import { type ExternalPlayerCandidate } from './playerMatching';
import { makeFieldSource, shouldOverride, sourcePriority, type DataSources } from './traceability';
import { ApiFootballPlayerProvider } from './providers/ApiFootballPlayerProvider';
import { SportmonksPlayerProvider } from './providers/SportmonksPlayerProvider';
import { TheSportsDbPlayerProvider } from './providers/TheSportsDbPlayerProvider';
import { TransfermarktPlayerProvider } from './providers/TransfermarktPlayerProvider';
import { WikimediaPlayerProvider } from './providers/WikimediaPlayerProvider';

const PROGRESS_PATH = 'reports/enrich-verified-progress.json';

const PLAYER_SELECT =
  'id,name,team_id,nationality,position,club,date_of_birth,shirt_number,height,weight,preferred_foot,market_value,market_value_eur,rating,photo_url,birth_place,detailed_position,external_profile_url,api_football_id,sportmonks_id,transfermarkt_id,thesportsdb_id,wikidata_id,verification_status,data_sources,conflicted_fields,data_quality_score,enrichment_status';

const FIELD_MAP: Array<{ col: string; pick: (c: ExternalPlayerCandidate) => unknown }> = [
  { col: 'photo_url', pick: c => c.photoUrl },
  { col: 'club', pick: c => c.club },
  { col: 'shirt_number', pick: c => c.shirtNumber },
  { col: 'height', pick: c => c.height },
  { col: 'weight', pick: c => c.weight },
  { col: 'preferred_foot', pick: c => c.preferredFoot },
  { col: 'rating', pick: c => c.rating },
  { col: 'birth_place', pick: c => c.birthPlace },
  { col: 'detailed_position', pick: c => c.detailedPosition },
];

interface VerifiedPlayerRow {
  id: string;
  name: string;
  nationality: string | null;
  date_of_birth: string | null;
  verification_status: string | null;
  data_sources: DataSources | null;
  conflicted_fields: string[] | null;
  [key: string]: unknown;
}

export interface VerifiedEnrichResult {
  scanned: number;
  enriched: number;
  conflicts: number;
  skipped: number;
  errors: number;
  conflictDetails: Array<{ playerId: string; name: string; field: string; sources: string[] }>;
  errorDetails: Array<{ playerId: string; name: string; error: string }>;
}

export interface VerifiedEnrichOptions {
  limit?: number;
  teamId?: string;
  country?: string;
  delayMs?: number;
  batchSize?: number;
  onlyMissingPhotos?: boolean;
  resume?: boolean;
  allTeams?: boolean;
}

const TEAM_PRIORITY = [
  'Argentina', 'Brazil', 'France', 'England', 'Spain', 'Portugal',
  'Germany', 'Netherlands', 'Uruguay', 'Belgium',
];

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function isBlank(v: unknown): boolean {
  return v == null || v === '' || v === 0;
}

function loadProgress(): { lastPlayerId?: string } {
  if (!existsSync(PROGRESS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(PROGRESS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveProgress(lastPlayerId: string) {
  mkdirSync('reports', { recursive: true });
  writeFileSync(PROGRESS_PATH, JSON.stringify({ lastPlayerId, updatedAt: new Date().toISOString() }, null, 2));
}

async function gatherCandidates(player: VerifiedPlayerRow): Promise<ExternalPlayerCandidate[]> {
  const all: ExternalPlayerCandidate[] = [];
  if (ApiFootballPlayerProvider.isConfigured()) {
    all.push(...(await ApiFootballPlayerProvider.searchCandidates(player.name, player.nationality)));
  }
  all.push(...(await SportmonksPlayerProvider.searchCandidates(player.name, player.nationality)));
  all.push(...(await TheSportsDbPlayerProvider.searchCandidates(player.name, player.nationality)));
  all.push(...(await WikimediaPlayerProvider.searchCandidates(player.name, player.nationality)));
  if (TransfermarktPlayerProvider.isConfigured() && player.transfermarkt_id) {
    const tm = await TransfermarktPlayerProvider.lookupByProviderId(String(player.transfermarkt_id));
    if (tm) all.push(tm);
  }
  return all;
}

async function resolveTeamId(country?: string, teamId?: string): Promise<string | undefined> {
  if (teamId) return teamId;
  if (!country) return undefined;
  const { data } = await supabase.from('teams').select('id,name').ilike('name', country).maybeSingle();
  if (data?.id) return data.id;
  const { data: teams } = await supabase.from('teams').select('id,name');
  return teams?.find(t => t.name.toLowerCase() === country.toLowerCase())?.id;
}

async function enrichVerifiedBatch(opts: VerifiedEnrichOptions): Promise<VerifiedEnrichResult> {
  const resolvedTeamId = await resolveTeamId(opts.country, opts.teamId);

  let query = supabase
    .from('players')
    .select(PLAYER_SELECT)
    .eq('verification_status', 'verified')
    .order('data_quality_score', { ascending: true })
    .order('id', { ascending: true });

  if (resolvedTeamId) query = query.eq('team_id', resolvedTeamId);
  if (opts.onlyMissingPhotos) query = query.is('photo_url', null);

  const { data, error } = await query;
  if (error) throw error;
  let players = (data ?? []) as VerifiedPlayerRow[];

  if (opts.resume) {
    const { lastPlayerId } = loadProgress();
    if (lastPlayerId) {
      const idx = players.findIndex(p => p.id === lastPlayerId);
      if (idx >= 0) players = players.slice(idx + 1);
    }
  }

  const batchCap = opts.batchSize ?? opts.limit;
  if (batchCap) players = players.slice(0, batchCap);

  const result: VerifiedEnrichResult = {
    scanned: 0,
    enriched: 0,
    conflicts: 0,
    skipped: 0,
    errors: 0,
    conflictDetails: [],
    errorDetails: [],
  };
  const delay = opts.delayMs ?? Number(process.env.PLAYER_ENRICH_DELAY_MS || 800);

  for (const player of players) {
    result.scanned++;
    try {
      const candidates = await gatherCandidates(player);
      if (candidates.length === 0) {
        await supabase
          .from('players')
          .update({
            enrichment_status: 'skipped',
            enrichment_error: 'no_candidates',
            last_enriched_at: new Date().toISOString(),
          })
          .eq('id', player.id);
        result.skipped++;
        saveProgress(player.id);
        await sleep(delay);
        continue;
      }

      const sources: DataSources = { ...(player.data_sources ?? {}) };
      const conflictedFields = new Set<string>(player.conflicted_fields ?? []);
      const patch: Record<string, unknown> = {};

      for (const field of FIELD_MAP) {
        if (opts.onlyMissingPhotos && field.col !== 'photo_url') continue;

        const offers = candidates
          .map(c => ({ source: c.source, value: field.pick(c) }))
          .filter(o => !isBlank(o.value))
          .sort((a, b) => sourcePriority(b.source) - sourcePriority(a.source));

        if (offers.length === 0) continue;

        const distinct = new Set(offers.map(o => String(o.value)));
        if (distinct.size > 1) {
          const top = offers.filter(o => sourcePriority(o.source) >= 70);
          const topDistinct = new Set(top.map(o => String(o.value)));
          if (topDistinct.size > 1) {
            conflictedFields.add(field.col);
            result.conflictDetails.push({
              playerId: player.id,
              name: player.name,
              field: field.col,
              sources: top.map(o => `${o.source}=${o.value}`),
            });
          }
        }

        const best = offers[0];
        if (isBlank(player[field.col]) || shouldOverride(sources[field.col], best.source)) {
          patch[field.col] = best.value;
          sources[field.col] = makeFieldSource(best.source, 90, 'verified');
        }
      }

      if (!opts.onlyMissingPhotos) {
        const mvOffer = candidates
          .map(c => ({ source: c.source, value: c.marketValue }))
          .filter(o => o.value != null)
          .sort((a, b) => sourcePriority(b.source) - sourcePriority(a.source))[0];
        if (mvOffer?.value != null && (isBlank(player.market_value) || shouldOverride(sources.market_value, mvOffer.source))) {
          patch.market_value = mvOffer.value;
          patch.market_value_eur = mvOffer.value;
          sources.market_value = makeFieldSource(mvOffer.source, 85, 'verified');
          await supabase
            .from('player_market_value_history')
            .upsert(
              { player_id: player.id, market_value_eur: mvOffer.value, source: mvOffer.source },
              { onConflict: 'player_id,source,market_value_eur' },
            );
        }
      }

      patch.last_enriched_at = new Date().toISOString();
      patch.updated_at = new Date().toISOString();

      if (Object.keys(patch).length > 2) {
        const merged = { ...player, ...patch };
        patch.data_sources = sources;
        patch.conflicted_fields = [...conflictedFields];
        patch.data_quality_score = calculatePlayerDataQuality(merged as Record<string, unknown>);

        if (conflictedFields.size > 0) {
          patch.verification_status = 'conflict';
          patch.enrichment_status = 'conflict';
          result.conflicts++;
        } else {
          patch.enrichment_status = 'enriched';
          result.enriched++;
        }
        await supabase.from('players').update(patch).eq('id', player.id);
      } else {
        await supabase
          .from('players')
          .update({ enrichment_status: 'skipped', last_enriched_at: new Date().toISOString() })
          .eq('id', player.id);
        result.skipped++;
      }
    } catch (err) {
      result.errors++;
      result.errorDetails.push({
        playerId: player.id,
        name: player.name,
        error: (err as Error).message,
      });
      await supabase
        .from('players')
        .update({
          enrichment_status: 'error',
          enrichment_error: (err as Error).message,
          last_enriched_at: new Date().toISOString(),
        })
        .eq('id', player.id);
    }
    saveProgress(player.id);
    await sleep(delay);
  }

  return result;
}

export async function enrichVerifiedPlayers(opts: VerifiedEnrichOptions = {}): Promise<VerifiedEnrichResult> {
  if (opts.allTeams) {
    const { data: teams } = await supabase.from('teams').select('id,name').order('name');
    const ordered = [...(teams ?? [])].sort((a, b) => {
      const ai = TEAM_PRIORITY.indexOf(a.name);
      const bi = TEAM_PRIORITY.indexOf(b.name);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.name.localeCompare(b.name);
    });

    const merged: VerifiedEnrichResult = {
      scanned: 0,
      enriched: 0,
      conflicts: 0,
      skipped: 0,
      errors: 0,
      conflictDetails: [],
      errorDetails: [],
    };

    for (const team of ordered) {
      console.log(`\n--- Enriqueciendo verificados: ${team.name} ---`);
      const part = await enrichVerifiedBatch({ ...opts, allTeams: false, teamId: team.id });
      merged.scanned += part.scanned;
      merged.enriched += part.enriched;
      merged.conflicts += part.conflicts;
      merged.skipped += part.skipped;
      merged.errors += part.errors;
      merged.conflictDetails.push(...part.conflictDetails);
      merged.errorDetails.push(...part.errorDetails);
    }

    writeEnrichReports(merged);
    return merged;
  }

  const result = await enrichVerifiedBatch(opts);
  writeEnrichReports(result);
  return result;
}

function writeEnrichReports(result: VerifiedEnrichResult) {
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/enrich-verified.json', JSON.stringify(result, null, 2));
  if (result.errorDetails.length > 0) {
    writeFileSync('reports/player-linking-errors.json', JSON.stringify(result.errorDetails, null, 2));
  }
}
