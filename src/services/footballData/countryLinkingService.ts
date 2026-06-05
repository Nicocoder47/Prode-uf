/** Sprint V2 — Fase 3: vinculación de países / selecciones nacionales */
import { mkdirSync, writeFileSync } from 'node:fs';
import { supabase } from '../../database/supabaseClient';
import { normalizeCountryName } from '../../utils/playerIdentityNormalizer';
import { lookupCountryReference, normalizeConfederation } from './providers/countryReference';
import {
  ApiFootballCountryProvider,
  TheSportsDbCountryProvider,
} from './providers/CountryExternalProvider';
import { makeFieldSource, type DataSources } from './traceability';

type CountryVerification = 'verified' | 'needs_review' | 'conflict' | 'unlinked';

interface TeamRow {
  id: string;
  name: string;
  code: string | null;
  fifa_code: string | null;
  iso2: string | null;
  iso3: string | null;
  confederation: string | null;
  flag_url: string | null;
  api_football_team_id: string | null;
  sportmonks_team_id: string | null;
  thesportsdb_team_id: string | null;
  wikidata_id: string | null;
  data_sources: DataSources | null;
  verification_status: string | null;
}

const TEAM_SELECT =
  'id,name,code,fifa_code,iso2,iso3,confederation,flag_url,api_football_team_id,sportmonks_team_id,thesportsdb_team_id,wikidata_id,data_sources,verification_status';

export interface CountryLinkResult {
  id: string;
  name: string;
  status: CountryVerification;
  fifaCode: string | null;
  iso3: string | null;
  matchedFields: string[];
  conflicts: string[];
  linkedExternalIds: Record<string, string>;
}

export interface CountryLinkingSummary {
  total: number;
  verified: number;
  needsReview: number;
  conflict: number;
  unlinked: number;
  results: CountryLinkResult[];
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function linkCountries(opts: { dryRun?: boolean } = {}): Promise<CountryLinkingSummary> {
  const { data, error } = await supabase.from('teams').select(TEAM_SELECT);
  if (error) throw error;
  const teams = (data ?? []) as TeamRow[];

  const results: CountryLinkResult[] = [];

  for (const team of teams) {
    const ref = lookupCountryReference(team.code || team.fifa_code || team.iso3 || team.name);
    const sources: DataSources = { ...(team.data_sources ?? {}) };
    const matchedFields: string[] = [];
    const conflicts: string[] = [];
    const patch: Record<string, unknown> = {};
    const linkedExternalIds: Record<string, string> = {};

    if (ref) {
      const nameMatches =
        normalizeCountryName(ref.name) === normalizeCountryName(team.name) ||
        (ref.officialName != null && normalizeCountryName(ref.officialName) === normalizeCountryName(team.name)) ||
        (team.code != null && ref.fifaCode.toUpperCase() === team.code.toUpperCase()) ||
        (team.fifa_code != null && ref.fifaCode.toUpperCase() === team.fifa_code.toUpperCase());

      const setRef = (field: keyof TeamRow, value: string | null | undefined, authoritative = false) => {
        if (!value) return;
        const current = team[field] ? String(team[field]) : '';
        if (!current) {
          patch[field] = value;
          sources[field] = makeFieldSource('iso-3166-reference', 95, 'verified');
          matchedFields.push(field);
          return;
        }

        const isConfederation = field === 'confederation';
        const matches = isConfederation
          ? normalizeConfederation(current) === normalizeConfederation(value)
          : current.toUpperCase() === value.toUpperCase();

        if (matches) return;

        if (isConfederation || authoritative) {
          patch[field] = value;
          sources[field] = makeFieldSource('iso-3166-reference', 92, 'verified');
          matchedFields.push(field);
        } else {
          conflicts.push(field);
        }
      };

      setRef('fifa_code', ref.fifaCode);
      setRef('iso2', ref.iso2);
      setRef('iso3', ref.iso3);
      setRef('confederation', ref.confederation, true);
      if (ref.wikidataId && !team.wikidata_id) {
        patch.wikidata_id = ref.wikidataId;
        sources.wikidata_id = makeFieldSource('wikidata', 90, 'verified', ref.wikidataId);
        linkedExternalIds.wikidata = ref.wikidataId;
      }

      // Providers externos para IDs y bandera
      const af = ApiFootballCountryProvider.isConfigured()
        ? await ApiFootballCountryProvider.search(team.name)
        : null;
      if (af?.externalId && !team.api_football_team_id) {
        patch.api_football_team_id = af.externalId;
        sources.api_football_team_id = makeFieldSource('api-football', 85, 'verified', af.externalId);
        linkedExternalIds.apiFootball = af.externalId;
      }
      if (af?.flagUrl && !team.flag_url) {
        patch.flag_url = af.flagUrl;
        sources.flag_url = makeFieldSource('api-football', 80, 'verified', af.externalId);
        matchedFields.push('flag_url');
      }

      const sdb = await TheSportsDbCountryProvider.search(team.name);
      if (sdb?.externalId && !team.thesportsdb_team_id) {
        patch.thesportsdb_team_id = sdb.externalId;
        sources.thesportsdb_team_id = makeFieldSource('thesportsdb', 70, 'verified', sdb.externalId);
        linkedExternalIds.thesportsdb = sdb.externalId;
      }
      if (sdb?.flagUrl && !patch.flag_url && !team.flag_url) {
        patch.flag_url = sdb.flagUrl;
        sources.flag_url = makeFieldSource('thesportsdb', 65, 'verified', sdb.externalId);
        matchedFields.push('flag_url');
      }

      let status: CountryVerification;
      if (conflicts.length > 0) status = 'conflict';
      else if (nameMatches || ref.fifaCode) status = 'verified';
      else status = 'needs_review';

      patch.verification_status = status;
      patch.data_sources = sources;
      patch.last_verified_at = new Date().toISOString();

      if (!opts.dryRun) {
        await supabase.from('teams').update(patch).eq('id', team.id);
      }

      results.push({
        id: team.id,
        name: team.name,
        status,
        fifaCode: (patch.fifa_code as string) ?? team.fifa_code,
        iso3: (patch.iso3 as string) ?? team.iso3,
        matchedFields,
        conflicts,
        linkedExternalIds,
      });
      await sleep(200);
    } else {
      results.push({
        id: team.id,
        name: team.name,
        status: 'unlinked',
        fifaCode: team.fifa_code,
        iso3: team.iso3,
        matchedFields: [],
        conflicts: [],
        linkedExternalIds: {},
      });
    }
  }

  const summary: CountryLinkingSummary = {
    total: results.length,
    verified: results.filter(r => r.status === 'verified').length,
    needsReview: results.filter(r => r.status === 'needs_review').length,
    conflict: results.filter(r => r.status === 'conflict').length,
    unlinked: results.filter(r => r.status === 'unlinked').length,
    results,
  };

  writeCountryReports(summary);
  return summary;
}

function writeCountryReports(summary: CountryLinkingSummary) {
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/country-linking.json', JSON.stringify(summary, null, 2));

  const lines: string[] = [];
  lines.push('# Vinculación de Países / Selecciones — Sprint V2');
  lines.push('');
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- Total: ${summary.total}`);
  lines.push(`- Verificados: ${summary.verified}`);
  lines.push(`- Needs review: ${summary.needsReview}`);
  lines.push(`- Conflictos: ${summary.conflict}`);
  lines.push(`- Sin vínculo: ${summary.unlinked}`);
  lines.push('');
  lines.push('| País | Estado | FIFA | ISO3 | Campos | Conflictos |');
  lines.push('|------|--------|------|------|--------|-----------|');
  for (const r of summary.results) {
    lines.push(
      `| ${r.name} | ${r.status} | ${r.fifaCode ?? '—'} | ${r.iso3 ?? '—'} | ${r.matchedFields.join(', ') || '—'} | ${r.conflicts.join(', ') || '—'} |`,
    );
  }
  writeFileSync('reports/country-linking.md', lines.join('\n'));
}
