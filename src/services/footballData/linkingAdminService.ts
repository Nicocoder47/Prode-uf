/** Sprint V2 — Fase 7: servicio admin de revisión manual de vínculos */
import { supabase } from '../../database/supabaseClient';
import { PRIORITY_TEAMS, computeUiReadiness } from '../../constants/dataPipeline';
import { hasReliableExternalId, computeTraceabilityScore } from './playerDataQuality';
const LINK_SELECT =
  'id,name,team_id,nationality,date_of_birth,position,club,verification_status,identity_confidence_score,verified_fields,conflicted_fields,identity_candidate,api_football_id,sportmonks_id,transfermarkt_id,wikidata_id,thesportsdb_id,data_sources,data_quality_score';

type Row = Record<string, any>;

async function teamNameMap(): Promise<Map<string, string>> {
  const { data } = await supabase.from('teams').select('id,name');
  return new Map((data ?? []).map(t => [t.id, t.name]));
}

function shape(p: Row, teams: Map<string, string>) {
  return {
    playerId: p.id,
    localName: p.name,
    localCountry: teams.get(p.team_id) ?? null,
    localBirthDate: p.date_of_birth,
    verificationStatus: p.verification_status,
    score: p.identity_confidence_score ?? 0,
    provider: p.identity_candidate?.source ?? null,
    candidate: p.identity_candidate ?? null,
    matchedFields: p.verified_fields ?? [],
    conflictedFields: p.conflicted_fields ?? [],
    hasExternalId: hasReliableExternalId(p),
    traceabilityScore: computeTraceabilityScore(p),
  };
}

export const linkingAdminService = {
  async playerStatus() {
    const { data, error } = await supabase
      .from('players')
      .select('verification_status,identity_confidence_score,photo_url,club,market_value,market_value_eur,enrichment_status');
    if (error) throw error;
    const rows = data ?? [];
    const by = (s: string) => rows.filter(r => r.verification_status === s).length;
    const total = rows.length || 1;
    return {
      total: rows.length,
      verified: by('verified'),
      needsReview: by('needs_review'),
      possibleMatch: by('possible_match'),
      conflict: by('conflict'),
      rejected: by('rejected'),
      unlinked: by('unlinked'),
      withPhoto: rows.filter(r => !!r.photo_url).length,
      withClub: rows.filter(r => !!r.club).length,
      withMarketValue: rows.filter(r => r.market_value != null || r.market_value_eur != null).length,
      verifiedPct: Math.round((by('verified') / total) * 1000) / 10,
      photoPct: Math.round((rows.filter(r => !!r.photo_url).length / total) * 1000) / 10,
      clubPct: Math.round((rows.filter(r => !!r.club).length / total) * 1000) / 10,
      marketValuePct: Math.round((rows.filter(r => r.market_value != null || r.market_value_eur != null).length / total) * 1000) / 10,
      enrichmentPending: rows.filter(r => r.enrichment_status === 'pending' || !r.enrichment_status).length,
    };
  },

  async teamProgress() {
    const { data: teams, error: te } = await supabase.from('teams').select('id,name').order('name');
    if (te) throw te;
    const { data: players, error: pe } = await supabase
      .from('players')
      .select('team_id,verification_status,photo_url,club,market_value,market_value_eur,rating');
    if (pe) throw pe;

    return (teams ?? []).map(t => {
      const list = (players ?? []).filter(p => p.team_id === t.id);
      const n = list.length || 1;
      const verified = list.filter(p => p.verification_status === 'verified').length;
      const photos = list.filter(p => !!p.photo_url).length;
      const clubs = list.filter(p => !!p.club).length;
      const ratings = list.filter(p => p.rating != null && Number(p.rating) > 0).length;
      const marketValues = list.filter(p => p.market_value != null || p.market_value_eur != null).length;
      const unlinked = list.filter(p => !p.verification_status || p.verification_status === 'unlinked').length;
      const verifiedPct = Math.round((verified / n) * 100);
      const photoPct = Math.round((photos / n) * 100);
      const clubPct = Math.round((clubs / n) * 100);
      const ratingPct = Math.round((ratings / n) * 100);
      const marketValuePct = Math.round((marketValues / n) * 100);
      const uiReadiness = computeUiReadiness({ verifiedPct, photoPct, clubPct });
      const isPriority = (PRIORITY_TEAMS as readonly string[]).includes(t.name);

      return {
        teamId: t.id,
        teamName: t.name,
        players: list.length,
        verified,
        verifiedPct,
        photos,
        photoPct,
        clubs,
        clubPct,
        ratings,
        ratingPct,
        marketValues,
        marketValuePct,
        unlinked,
        uiReadiness,
        isPriority,
      };
    });
  },

  async priorityTeamStatus() {
    const progress = await this.teamProgress();
    const teams = progress.filter(t => t.isPriority);
    const ready = teams.filter(t => t.uiReadiness === 'READY_FOR_UI');
    return {
      totalPriority: PRIORITY_TEAMS.length,
      tracked: teams.length,
      readyCount: ready.length,
      allReady: ready.length >= PRIORITY_TEAMS.length && teams.length >= PRIORITY_TEAMS.length,
      teams,
      readyTeams: ready.map(t => t.teamName),
      pendingTeams: teams.filter(t => t.uiReadiness !== 'READY_FOR_UI').map(t => t.teamName),
    };
  },
  async unlinkedPlayers(limit = 200) {
    const teams = await teamNameMap();
    const { data, error } = await supabase
      .from('players')
      .select(LINK_SELECT)
      .or('verification_status.eq.unlinked,verification_status.eq.rejected,verification_status.is.null')
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(p => shape(p, teams));
  },

  async possibleMatches(limit = 200) {
    const teams = await teamNameMap();
    const { data, error } = await supabase
      .from('players')
      .select(LINK_SELECT)
      .in('verification_status', ['needs_review', 'possible_match'])
      .order('identity_confidence_score', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(p => shape(p, teams));
  },

  async conflicts(limit = 200) {
    const teams = await teamNameMap();
    const { data, error } = await supabase
      .from('players')
      .select(LINK_SELECT)
      .eq('verification_status', 'conflict')
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(p => shape(p, teams));
  },

  async verifiedPlayers(limit = 200) {
    const teams = await teamNameMap();
    const { data, error } = await supabase
      .from('players')
      .select(LINK_SELECT)
      .eq('verification_status', 'verified')
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(p => shape(p, teams));
  },

  /** Aprueba el vínculo: marca verified y persiste el external_id del candidato. */
  async approve(playerId: string) {
    const { data, error } = await supabase
      .from('players')
      .select('identity_candidate,data_sources')
      .eq('id', playerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, reason: 'not_found' };

    const candidate = (data as Row).identity_candidate;
    const update: Row = {
      verification_status: 'verified',
      last_verified_at: new Date().toISOString(),
      last_identity_check_at: new Date().toISOString(),
    };
    if (candidate?.externalId && candidate?.source) {
      const colMap: Record<string, string> = {
        'api-football': 'api_football_id',
        sportmonks: 'sportmonks_id',
        thesportsdb: 'thesportsdb_id',
        wikidata: 'wikidata_id',
        transfermarkt: 'transfermarkt_id',
      };
      const col = colMap[candidate.source];
      if (col) update[col] = String(candidate.externalId);
      const sources = { ...((data as Row).data_sources ?? {}) };
      sources[`identity:${candidate.source}`] = {
        source: candidate.source,
        providerId: candidate.externalId,
        fetchedAt: new Date().toISOString(),
        confidence: 100,
        verificationStatus: 'verified',
      };
      update.data_sources = sources;
    }
    await supabase.from('players').update(update).eq('id', playerId);
    return { ok: true };
  },

  async reject(playerId: string) {
    await supabase
      .from('players')
      .update({
        verification_status: 'rejected',
        identity_candidate: null,
        last_identity_check_at: new Date().toISOString(),
      })
      .eq('id', playerId);
    return { ok: true };
  },

  async markConflict(playerId: string) {
    await supabase
      .from('players')
      .update({
        verification_status: 'conflict',
        last_identity_check_at: new Date().toISOString(),
      })
      .eq('id', playerId);
    return { ok: true };
  },

  // ── países ──
  async countryStatus() {
    const { data, error } = await supabase.from('teams').select('verification_status,fifa_code,iso3');
    if (error) throw error;
    const rows = data ?? [];
    return {
      total: rows.length,
      verified: rows.filter(r => r.verification_status === 'verified').length,
      needsReview: rows.filter(r => r.verification_status === 'needs_review').length,
      conflict: rows.filter(r => r.verification_status === 'conflict').length,
      unlinked: rows.filter(r => !r.verification_status || r.verification_status === 'unlinked').length,
      missingCodes: rows.filter(r => !r.fifa_code || !r.iso3).length,
    };
  },

  async unlinkedCountries() {
    const { data, error } = await supabase
      .from('teams')
      .select('id,name,fifa_code,iso3,verification_status')
      .or('verification_status.eq.unlinked,verification_status.eq.needs_review,verification_status.is.null');
    if (error) throw error;
    return data ?? [];
  },

  async approveCountry(countryId: string) {
    await supabase
      .from('teams')
      .update({ verification_status: 'verified', last_verified_at: new Date().toISOString() })
      .eq('id', countryId);
    return { ok: true };
  },
};

export default linkingAdminService;
