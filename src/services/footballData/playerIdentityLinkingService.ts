/** Sprint V2 — Fase 4: vinculación de identidad de jugadores */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { supabase } from '../../database/supabaseClient';
import { generatePlayerIdentityKey } from '../../utils/playerIdentityNormalizer';
import {
  bestIdentityMatch,
  type IdentityMatchResult,
  type LocalIdentityInput,
} from './playerIdentityMatch';
import { type ExternalPlayerCandidate } from './playerMatching';
import { makeFieldSource } from './traceability';
import { ApiFootballPlayerProvider } from './providers/ApiFootballPlayerProvider';
import { SportmonksPlayerProvider } from './providers/SportmonksPlayerProvider';
import { TheSportsDbPlayerProvider } from './providers/TheSportsDbPlayerProvider';
import { WikimediaPlayerProvider } from './providers/WikimediaPlayerProvider';

const PROGRESS_PATH = 'reports/identity-link-progress.json';

const PLAYER_SELECT =
  'id,name,team_id,nationality,position,club,date_of_birth,api_football_id,sportmonks_id,thesportsdb_id,wikidata_id,verification_status,identity_confidence_score,verified_fields,conflicted_fields,source_priority,data_sources';

interface PlayerRow {
  id: string;
  name: string;
  team_id: string;
  nationality: string | null;
  position: string | null;
  club: string | null;
  date_of_birth: string | null;
  api_football_id: string | null;
  sportmonks_id: string | null;
  thesportsdb_id: string | null;
  wikidata_id: string | null;
  verification_status: string | null;
  identity_confidence_score: number | null;
  source_priority: Record<string, number> | null;
  data_sources: Record<string, unknown> | null;
}

export interface IdentityLinkOptions {
  teamId?: string;
  country?: string;
  resume?: boolean;
  dryRun?: boolean;
  limit?: number;
  delayMs?: number;
  batchSize?: number;
  skipVerified?: boolean;
  allTeams?: boolean;
}

export interface IdentityLinkRecord {
  playerId: string;
  name: string;
  teamId: string;
  status: IdentityMatchResult['verification'] | 'no_candidates';
  score: number;
  provider: string | null;
  candidateName: string | null;
  matchedFields: string[];
  conflictedFields: string[];
}

export interface IdentityLinkSummary {
  scanned: number;
  verified: number;
  needsReview: number;
  possibleMatch: number;
  rejected: number;
  noCandidates: number;
  records: IdentityLinkRecord[];
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

function saveProgress(lastPlayerId: string) {
  mkdirSync('reports', { recursive: true });
  writeFileSync(PROGRESS_PATH, JSON.stringify({ lastPlayerId, updatedAt: new Date().toISOString() }, null, 2));
}

async function gatherCandidates(player: PlayerRow): Promise<ExternalPlayerCandidate[]> {
  const all: ExternalPlayerCandidate[] = [];
  if (ApiFootballPlayerProvider.isConfigured()) {
    all.push(...(await ApiFootballPlayerProvider.searchCandidates(player.name, player.nationality)));
  }
  all.push(...(await SportmonksPlayerProvider.searchCandidates(player.name, player.nationality)));
  all.push(...(await TheSportsDbPlayerProvider.searchCandidates(player.name, player.nationality)));
  all.push(...(await WikimediaPlayerProvider.searchCandidates(player.name, player.nationality)));
  return all;
}

function externalIdPatch(candidate: ExternalPlayerCandidate, player: PlayerRow): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (!candidate.externalId) return patch;
  const map: Record<string, keyof PlayerRow> = {
    'api-football': 'api_football_id',
    sportmonks: 'sportmonks_id',
    thesportsdb: 'thesportsdb_id',
    wikidata: 'wikidata_id',
  };
  const col = map[candidate.source];
  if (col && !player[col]) patch[col] = candidate.externalId;
  return patch;
}

async function processPlayer(
  player: PlayerRow,
  opts: IdentityLinkOptions,
  teamNames: Map<string, string>,
): Promise<IdentityLinkRecord> {
  const local: LocalIdentityInput = {
    name: player.name,
    date_of_birth: player.date_of_birth,
    nationality: player.nationality,
    country: teamNames.get(player.team_id) ?? null,
    position: player.position,
    club: player.club,
  };

  const candidates = await gatherCandidates(player);
  const match = bestIdentityMatch(local, candidates);

  // No degradar identidad ya verificada
  if (player.verification_status === 'verified') {
    if (!match || match.verification !== 'verified' || match.score < (player.identity_confidence_score ?? 80)) {
      return {
        playerId: player.id,
        name: player.name,
        teamId: player.team_id,
        status: 'verified',
        score: player.identity_confidence_score ?? 80,
        provider: null,
        candidateName: null,
        matchedFields: [],
        conflictedFields: [],
      };
    }
  }

  if (!match) {
    if (!opts.dryRun) {
      await supabase
        .from('players')
        .update({
          verification_status: 'unlinked',
          identity_confidence_score: 0,
          identity_key: generatePlayerIdentityKey({ ...local, team: local.country }),
          last_identity_check_at: new Date().toISOString(),
        })
        .eq('id', player.id);
    }
    return {
      playerId: player.id,
      name: player.name,
      teamId: player.team_id,
      status: 'no_candidates',
      score: 0,
      provider: null,
      candidateName: null,
      matchedFields: [],
      conflictedFields: [],
    };
  }

  const { verification, score, candidate, matchedFields, conflictedFields } = match;

  const update: Record<string, unknown> = {
    verification_status: verification,
    identity_confidence_score: score,
    verified_fields: matchedFields,
    conflicted_fields: conflictedFields,
    identity_key: generatePlayerIdentityKey({ ...local, team: local.country }),
    identity_candidate: {
      source: candidate.source,
      externalId: candidate.externalId,
      name: candidate.name,
      birthDate: candidate.birthDate,
      nationality: candidate.nationality,
      score,
      reasons: match.reasons,
    },
    last_identity_check_at: new Date().toISOString(),
  };

  // Regla crítica: solo asignar external_id si score >= 80 (verified).
  if (verification === 'verified') {
    Object.assign(update, externalIdPatch(candidate, player));
    if (candidate.externalId) {
      const sources = { ...(player.data_sources ?? {}) };
      sources[`identity:${candidate.source}`] = makeFieldSource(
        candidate.source,
        score,
        'verified',
        candidate.externalId,
      ) as unknown as string;
      update.data_sources = sources;
    }
    update.last_verified_at = new Date().toISOString();
  }

  if (!opts.dryRun) {
    await supabase.from('players').update(update).eq('id', player.id);
  }

  return {
    playerId: player.id,
    name: player.name,
    teamId: player.team_id,
    status: verification,
    score,
    provider: candidate.source,
    candidateName: candidate.name,
    matchedFields,
    conflictedFields,
  };
}

export async function relinkSinglePlayer(playerId: string): Promise<IdentityLinkRecord | null> {
  const teamNames = new Map<string, string>();
  const { data: teams } = await supabase.from('teams').select('id,name');
  for (const t of teams ?? []) teamNames.set(t.id, t.name);

  const { data, error } = await supabase.from('players').select(PLAYER_SELECT).eq('id', playerId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return processPlayer(data as PlayerRow, {}, teamNames);
}

export async function linkPlayerIdentities(opts: IdentityLinkOptions = {}): Promise<IdentityLinkSummary> {
  const skipVerified = opts.skipVerified !== false;

  if (opts.allTeams) {
    const teamNames = new Map<string, string>();
    const { data: teams } = await supabase.from('teams').select('id,name').order('name');
    for (const t of teams ?? []) teamNames.set(t.id, t.name);

    const priority = [
      'Argentina', 'Brazil', 'France', 'England', 'Spain', 'Portugal',
      'Germany', 'Netherlands', 'Uruguay', 'Belgium',
    ];
    const ordered = [...(teams ?? [])].sort((a, b) => {
      const ai = priority.indexOf(a.name);
      const bi = priority.indexOf(b.name);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.name.localeCompare(b.name);
    });

    const merged: IdentityLinkRecord[] = [];
    let scanned = 0;
    let verified = 0;
    let needsReview = 0;
    let possibleMatch = 0;
    let rejected = 0;
    let noCandidates = 0;

    for (const team of ordered) {
      console.log(`\n--- Vinculando: ${team.name} ---`);
      const part = await linkPlayerIdentities({
        ...opts,
        allTeams: false,
        teamId: team.id,
        skipVerified,
      });
      scanned += part.scanned;
      verified += part.verified;
      needsReview += part.needsReview;
      possibleMatch += part.possibleMatch;
      rejected += part.rejected;
      noCandidates += part.noCandidates;
      merged.push(...part.records);
    }

    const summary: IdentityLinkSummary = {
      scanned,
      verified,
      needsReview,
      possibleMatch,
      rejected,
      noCandidates,
      records: merged,
    };
    writeIdentityReports(summary, teamNames);
    return summary;
  }

  const teamNames = new Map<string, string>();
  {
    const { data: teams } = await supabase.from('teams').select('id,name');
    for (const t of teams ?? []) teamNames.set(t.id, t.name);
  }

  let query = supabase.from('players').select(PLAYER_SELECT).order('id', { ascending: true });
  if (opts.teamId) query = query.eq('team_id', opts.teamId);
  if (opts.country) {
    const teamId = [...teamNames.entries()].find(
      ([, name]) => name.toLowerCase() === opts.country!.toLowerCase(),
    )?.[0];
    if (teamId) query = query.eq('team_id', teamId);
  }

  const { data, error } = await query;
  if (error) throw error;
  let players = (data ?? []) as PlayerRow[];

  if (opts.resume) {
    const { lastPlayerId } = loadProgress();
    if (lastPlayerId) {
      const idx = players.findIndex(p => p.id === lastPlayerId);
      if (idx >= 0) players = players.slice(idx + 1);
    }
  }
  if (skipVerified) {
    players = players.filter(p => p.verification_status !== 'verified');
  }
  const batchCap = opts.batchSize ?? opts.limit;
  if (batchCap) players = players.slice(0, batchCap);

  const records: IdentityLinkRecord[] = [];
  const errors: Array<{ playerId: string; name: string; error: string }> = [];
  const delay = opts.delayMs ?? Number(process.env.PLAYER_ENRICH_DELAY_MS || 800);

  for (const player of players) {
    try {
      const rec = await processPlayer(player, opts, teamNames);
      records.push(rec);
    } catch (err) {
      const msg = (err as Error).message;
      errors.push({ playerId: player.id, name: player.name, error: msg });
      records.push({
        playerId: player.id,
        name: player.name,
        teamId: player.team_id,
        status: 'no_candidates',
        score: 0,
        provider: null,
        candidateName: `error: ${msg}`,
        matchedFields: [],
        conflictedFields: [],
      });
    }
    if (!opts.dryRun) saveProgress(player.id);
    await sleep(delay);
  }

  const summary: IdentityLinkSummary = {
    scanned: records.length,
    verified: records.filter(r => r.status === 'verified').length,
    needsReview: records.filter(r => r.status === 'needs_review').length,
    possibleMatch: records.filter(r => r.status === 'possible_match').length,
    rejected: records.filter(r => r.status === 'rejected').length,
    noCandidates: records.filter(r => r.status === 'no_candidates').length,
    records,
  };

  writeIdentityReports(summary, teamNames);
  if (errors.length > 0) {
    mkdirSync('reports', { recursive: true });
    writeFileSync('reports/player-linking-errors.json', JSON.stringify(errors, null, 2));
  }
  return summary;
}

function writeIdentityReports(summary: IdentityLinkSummary, teamNames: Map<string, string>) {
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/player-identity-linking.json', JSON.stringify(summary, null, 2));

  const conflicts = summary.records.filter(
    r => r.conflictedFields.length > 0 || r.status === 'possible_match',
  );
  writeFileSync('reports/player-identity-conflicts.json', JSON.stringify(conflicts, null, 2));

  const needsReview = summary.records.filter(r => r.status === 'needs_review' || r.status === 'possible_match');
  writeFileSync('reports/player-needs-review.json', JSON.stringify(needsReview, null, 2));

  const lines: string[] = [];
  lines.push('# Vinculación de Identidad de Jugadores — Sprint V2');
  lines.push('');
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- Escaneados: ${summary.scanned}`);
  lines.push(`- Verificados (>=80): ${summary.verified}`);
  lines.push(`- Needs review (60-79): ${summary.needsReview}`);
  lines.push(`- Possible match (50-59): ${summary.possibleMatch}`);
  lines.push(`- Rechazados (<60): ${summary.rejected}`);
  lines.push(`- Sin candidatos: ${summary.noCandidates}`);
  lines.push('');
  lines.push('## Posibles matches y conflictos (revisión manual)');
  lines.push('');
  lines.push('| Jugador | Selección | Estado | Score | Provider | Candidato | Conflictos |');
  lines.push('|---------|-----------|--------|-------|----------|-----------|-----------|');
  for (const r of summary.records.filter(x => x.status === 'needs_review' || x.status === 'possible_match')) {
    lines.push(
      `| ${r.name} | ${teamNames.get(r.teamId) ?? '—'} | ${r.status} | ${r.score} | ${r.provider ?? '—'} | ${r.candidateName ?? '—'} | ${r.conflictedFields.join(', ') || '—'} |`,
    );
  }
  writeFileSync('reports/player-identity-linking.md', lines.join('\n'));
}
