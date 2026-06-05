/** Sprint V2 — Fase 6: detección y resolución de conflictos entre fuentes */
import { mkdirSync, writeFileSync } from 'node:fs';
import { supabase } from '../../database/supabaseClient';
import { nationalitiesMatch } from '../../providers/enrichment/playerMatch';
import { type ExternalPlayerCandidate } from './playerMatching';
import { sourcePriority, type DataSources } from './traceability';
import { ApiFootballPlayerProvider } from './providers/ApiFootballPlayerProvider';
import { SportmonksPlayerProvider } from './providers/SportmonksPlayerProvider';
import { TheSportsDbPlayerProvider } from './providers/TheSportsDbPlayerProvider';
import { TransfermarktPlayerProvider } from './providers/TransfermarktPlayerProvider';

const PLAYER_SELECT =
  'id,name,team_id,nationality,date_of_birth,position,club,height,market_value_eur,photo_url,api_football_id,transfermarkt_id,verification_status,conflicted_fields,data_sources';

const CONFLICT_FIELDS = [
  'date_of_birth',
  'nationality',
  'position',
  'club',
  'height',
  'market_value_eur',
  'photo_url',
] as const;

interface PlayerRow {
  id: string;
  name: string;
  team_id: string;
  nationality: string | null;
  date_of_birth: string | null;
  position: string | null;
  club: string | null;
  height: number | null;
  market_value_eur: number | null;
  photo_url: string | null;
  transfermarkt_id: string | null;
  verification_status: string | null;
  conflicted_fields: string[] | null;
  data_sources: DataSources | null;
}

interface FieldConflict {
  field: string;
  local: unknown;
  candidates: Array<{ source: string; value: unknown }>;
  severity: 'critical' | 'normal';
}

export interface PlayerConflictRecord {
  playerId: string;
  name: string;
  teamId: string;
  conflicts: FieldConflict[];
  resolution: 'verified' | 'conflict' | 'blocked';
}

export interface ConflictSummary {
  scanned: number;
  withConflicts: number;
  blocked: number;
  records: PlayerConflictRecord[];
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function valueForField(c: ExternalPlayerCandidate, field: string): unknown {
  switch (field) {
    case 'date_of_birth':
      return c.birthDate ? c.birthDate.slice(0, 10) : null;
    case 'nationality':
      return c.nationality;
    case 'position':
      return c.position ?? c.detailedPosition;
    case 'club':
      return c.club;
    case 'height':
      return c.height;
    case 'market_value_eur':
      return c.marketValue;
    case 'photo_url':
      return c.photoUrl;
    default:
      return null;
  }
}

function valuesConflict(field: string, a: unknown, b: unknown): boolean {
  if (a == null || b == null) return false;
  if (field === 'nationality') return !nationalitiesMatch(String(a), String(b));
  if (field === 'date_of_birth') return String(a).slice(0, 10) !== String(b).slice(0, 10);
  if (field === 'height') return Math.abs(Number(a) - Number(b)) > 2;
  if (field === 'market_value_eur') {
    const max = Math.max(Number(a), Number(b)) || 1;
    return Math.abs(Number(a) - Number(b)) / max > 0.25;
  }
  if (field === 'photo_url') return false; // distintas urls no son conflicto real
  return String(a).toLowerCase() !== String(b).toLowerCase();
}

async function gatherCandidates(player: PlayerRow): Promise<ExternalPlayerCandidate[]> {
  const all: ExternalPlayerCandidate[] = [];
  if (ApiFootballPlayerProvider.isConfigured()) {
    all.push(...(await ApiFootballPlayerProvider.searchCandidates(player.name, player.nationality)));
  }
  all.push(...(await SportmonksPlayerProvider.searchCandidates(player.name, player.nationality)));
  all.push(...(await TheSportsDbPlayerProvider.searchCandidates(player.name, player.nationality)));
  if (TransfermarktPlayerProvider.isConfigured() && player.transfermarkt_id) {
    const tm = await TransfermarktPlayerProvider.lookupByProviderId(String(player.transfermarkt_id));
    if (tm) all.push(tm);
  }
  return all;
}

export async function resolvePlayerConflicts(
  opts: { limit?: number; teamId?: string; delayMs?: number } = {},
): Promise<ConflictSummary> {
  let query = supabase
    .from('players')
    .select(PLAYER_SELECT)
    .in('verification_status', ['verified', 'conflict', 'needs_review']);
  if (opts.teamId) query = query.eq('team_id', opts.teamId);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  const players = (data ?? []) as PlayerRow[];

  const records: PlayerConflictRecord[] = [];
  const delay = opts.delayMs ?? Number(process.env.PLAYER_ENRICH_DELAY_MS || 800);

  for (const player of players) {
    try {
      const candidates = await gatherCandidates(player);
      const conflicts: FieldConflict[] = [];

      for (const field of CONFLICT_FIELDS) {
        const local = player[field as keyof PlayerRow];
        const offers = candidates
          .map(c => ({ source: c.source, value: valueForField(c, field) }))
          .filter(o => o.value != null);

        // conflicto local vs fuente confiable
        const conflicting = offers.filter(o => valuesConflict(field, local, o.value) && sourcePriority(o.source) >= 70);

        // conflicto entre dos fuentes confiables
        const reliable = offers.filter(o => sourcePriority(o.source) >= 70);
        const interSource = reliable.some(a => reliable.some(b => valuesConflict(field, a.value, b.value)));

        if (conflicting.length > 0 || interSource) {
          const severity =
            field === 'date_of_birth' || field === 'nationality' ? 'critical' : 'normal';
          conflicts.push({
            field,
            local,
            candidates: reliable.map(o => ({ source: o.source, value: o.value })),
            severity,
          });
        }
      }

      let resolution: PlayerConflictRecord['resolution'] = 'verified';
      if (conflicts.some(c => c.severity === 'critical')) resolution = 'blocked';
      else if (conflicts.length > 0) resolution = 'conflict';

      const update: Record<string, unknown> = {
        conflicted_fields: conflicts.map(c => c.field),
      };
      if (resolution === 'blocked') {
        update.verification_status = 'conflict';
      } else if (resolution === 'conflict') {
        update.verification_status = 'conflict';
      }
      await supabase.from('players').update(update).eq('id', player.id);

      records.push({
        playerId: player.id,
        name: player.name,
        teamId: player.team_id,
        conflicts,
        resolution,
      });
    } catch {
      // ignorar errores individuales
    }
    await sleep(delay);
  }

  const summary: ConflictSummary = {
    scanned: records.length,
    withConflicts: records.filter(r => r.conflicts.length > 0).length,
    blocked: records.filter(r => r.resolution === 'blocked').length,
    records,
  };

  writeConflictReports(summary);
  return summary;
}

function writeConflictReports(summary: ConflictSummary) {
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/player-conflicts.json', JSON.stringify(summary, null, 2));

  const lines: string[] = [];
  lines.push('# Conflictos de Datos de Jugadores — Sprint V2');
  lines.push('');
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- Escaneados: ${summary.scanned}`);
  lines.push(`- Con conflictos: ${summary.withConflicts}`);
  lines.push(`- Bloqueados (conflicto crítico): ${summary.blocked}`);
  lines.push('');
  lines.push('| Jugador | Campo | Severidad | Local | Fuentes |');
  lines.push('|---------|-------|-----------|-------|---------|');
  for (const r of summary.records) {
    for (const c of r.conflicts) {
      lines.push(
        `| ${r.name} | ${c.field} | ${c.severity} | ${String(c.local ?? '—')} | ${c.candidates.map(x => `${x.source}=${x.value}`).join('; ')} |`,
      );
    }
  }
  writeFileSync('reports/player-conflicts.md', lines.join('\n'));
}
