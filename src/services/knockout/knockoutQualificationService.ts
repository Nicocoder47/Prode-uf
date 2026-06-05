/**
 * Knockout automático WC 2026 — clasificación desde standings/matches reales.
 * Matriz Annex C: src/data/knockoutThirdPlaceMatrix.json (495 combinaciones FIFA).
 */
import { supabase } from '../../database/supabaseClient';
import { WC26_GROUP_NAMES } from '../../constants/groups';
import {
  KNOCKOUT_MATCH_TEMPLATES,
  TBD_TEAM_ID,
  type BracketSource,
  type GroupLetter,
  type WinnerSlot,
} from '../../constants/knockoutBracket';
import thirdPlaceMatrix from '../../data/knockoutThirdPlaceMatrix.json';

export type GroupStandingRow = {
  teamId: string;
  teamName: string;
  groupLabel: GroupLetter;
  rank: number;
  played: number;
  points: number;
  goalDiff: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type GroupQualifiers = {
  first: Partial<Record<GroupLetter, GroupStandingRow>>;
  second: Partial<Record<GroupLetter, GroupStandingRow>>;
  third: Partial<Record<GroupLetter, GroupStandingRow>>;
  bestThirds: GroupStandingRow[];
  qualifyingThirdGroups: GroupLetter[];
  combinationKey: string | null;
};

export type KnockoutSyncResult = {
  ok: boolean;
  generatedAt: string;
  groupsComplete: GroupLetter[];
  groupsPending: GroupLetter[];
  allGroupsComplete: boolean;
  qualifiers: GroupQualifiers | null;
  matchesUpserted: number;
  matchesResolved: number;
  matchesPending: number;
  predictionsEnabled: number;
  errors: string[];
  bracket: Array<{
    bracketKey: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homePlaceholder: string;
    awayPlaceholder: string;
    resolved: boolean;
    predictionsOpen: boolean;
  }>;
};

type DbStanding = {
  team_id: string;
  group_label: string | null;
  rank: number;
  played: number;
  points: number;
  goal_diff: number;
  goals_for: number;
  goals_against: number;
  teams?: { name?: string } | { name?: string }[] | null;
};

type DbMatch = {
  id: string;
  bracket_key: string | null;
  status: string;
  score_home: number | null;
  score_away: number | null;
  score_home_penalties: number | null;
  score_away_penalties: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  provider_match_id?: string;
  kick_off?: string;
};

const GROUP_MATCHES_REQUIRED = 6;

function normalizeGroup(label: string | null | undefined): GroupLetter | null {
  if (!label) return null;
  const m = label.toUpperCase().match(/^([A-L])$/);
  return m ? (m[1] as GroupLetter) : null;
}

function teamName(row: DbStanding): string {
  const t = row.teams;
  if (Array.isArray(t)) return t[0]?.name ?? 'Equipo';
  if (t && typeof t === 'object') return (t as { name?: string }).name ?? 'Equipo';
  return 'Equipo';
}

function compareStandings(a: GroupStandingRow, b: GroupStandingRow): number {
  return (
    b.points - a.points ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    a.goalsAgainst - b.goalsAgainst ||
    a.groupLabel.localeCompare(b.groupLabel)
  );
}

export async function loadGroupStandings(): Promise<GroupStandingRow[]> {
  const { data, error } = await supabase
    .from('standings')
    .select('team_id,group_label,rank,played,points,goal_diff,goals_for,goals_against,teams(name)')
    .eq('phase', 'group');
  if (error) throw error;

  return (data ?? [])
    .map((row: DbStanding) => {
      const groupLabel = normalizeGroup(row.group_label);
      if (!groupLabel) return null;
      return {
        teamId: row.team_id,
        teamName: teamName(row),
        groupLabel,
        rank: row.rank,
        played: row.played,
        points: row.points,
        goalDiff: row.goal_diff,
        goalsFor: row.goals_for,
        goalsAgainst: row.goals_against,
      } satisfies GroupStandingRow;
    })
    .filter(Boolean) as GroupStandingRow[];
}

export async function getGroupCompletionStatus(): Promise<{
  complete: GroupLetter[];
  pending: GroupLetter[];
}> {
  const { data: groupMatches } = await supabase
    .from('matches')
    .select('id,group_label,status')
    .eq('phase', 'GROUP_STAGE');

  const complete: GroupLetter[] = [];
  const pending: GroupLetter[] = [];

  for (const g of WC26_GROUP_NAMES) {
    const gm = (groupMatches ?? []).filter(m => normalizeGroup(m.group_label) === g);
    const finished = gm.filter(m => m.status === 'finished').length;
    if (gm.length >= GROUP_MATCHES_REQUIRED && finished >= GROUP_MATCHES_REQUIRED) {
      complete.push(g);
    } else {
      pending.push(g);
    }
  }

  return { complete, pending };
}

export function rankGroupPositions(rows: GroupStandingRow[]): GroupQualifiers {
  const byGroup = new Map<GroupLetter, GroupStandingRow[]>();
  for (const g of WC26_GROUP_NAMES) byGroup.set(g, []);

  for (const row of rows) {
    byGroup.get(row.groupLabel)?.push(row);
  }

  const first: GroupQualifiers['first'] = {};
  const second: GroupQualifiers['second'] = {};
  const third: GroupQualifiers['third'] = {};

  for (const g of WC26_GROUP_NAMES) {
    const sorted = [...(byGroup.get(g) ?? [])].sort((a, b) => {
      if (a.rank && b.rank && a.rank !== b.rank) return a.rank - b.rank;
      return compareStandings(a, b);
    });
    if (sorted[0]) first[g] = { ...sorted[0], rank: 1 };
    if (sorted[1]) second[g] = { ...sorted[1], rank: 2 };
    if (sorted[2]) third[g] = { ...sorted[2], rank: 3 };
  }

  const allThirds = WC26_GROUP_NAMES.map(g => third[g]).filter(Boolean) as GroupStandingRow[];
  const bestThirds = [...allThirds].sort(compareStandings).slice(0, 8);
  const qualifyingThirdGroups = bestThirds.map(t => t.groupLabel).sort();
  const combinationKey = qualifyingThirdGroups.length === 8 ? qualifyingThirdGroups.join('') : null;

  return { first, second, third, bestThirds, qualifyingThirdGroups, combinationKey };
}

function resolveThirdForWinnerSlot(
  source: BracketSource,
  qualifiers: GroupQualifiers
): GroupStandingRow | null {
  if (!source.startsWith('3@')) return null;
  const slot = source.slice(2) as WinnerSlot;
  if (!qualifiers.combinationKey) return null;

  const matrix = (thirdPlaceMatrix as Record<string, Record<WinnerSlot, string>>)[
    qualifiers.combinationKey
  ];
  if (!matrix) return null;

  const thirdCode = matrix[slot];
  if (!thirdCode?.startsWith('3')) return null;
  const group = thirdCode.slice(1) as GroupLetter;
  return qualifiers.third[group] ?? null;
}

function resolveGroupSlot(
  source: BracketSource,
  qualifiers: GroupQualifiers
): GroupStandingRow | null {
  if (source.startsWith('3@')) return resolveThirdForWinnerSlot(source, qualifiers);
  if (source.length !== 2) return null;
  const pos = source[0];
  const group = source[1] as GroupLetter;
  if (pos === '1') return qualifiers.first[group] ?? null;
  if (pos === '2') return qualifiers.second[group] ?? null;
  return null;
}

function getMatchWinnerTeamId(match: DbMatch): string | null {
  if (match.status !== 'finished') return null;
  const h = match.score_home;
  const a = match.score_away;
  if (h == null || a == null) return null;

  if (h !== a) {
    return h > a ? match.home_team_id : match.away_team_id;
  }

  const hp = match.score_home_penalties;
  const ap = match.score_away_penalties;
  if (hp != null && ap != null && hp !== ap) {
    return hp > ap ? match.home_team_id : match.away_team_id;
  }

  return null;
}

function getMatchLoserTeamId(match: DbMatch): string | null {
  if (match.status !== 'finished') return null;
  const winner = getMatchWinnerTeamId(match);
  if (!winner) return null;
  return winner === match.home_team_id ? match.away_team_id : match.home_team_id;
}

function resolveWinnerSlot(source: BracketSource, matchByKey: Map<string, DbMatch>): string | null {
  if (!source.startsWith('W') && !source.startsWith('L')) return null;
  const isLoser = source.startsWith('L');
  const key = source.slice(1);
  const match = matchByKey.get(key.startsWith('M') ? key : `M${key}`);
  if (!match) return null;
  return isLoser ? getMatchLoserTeamId(match) : getMatchWinnerTeamId(match);
}

function isRealTeamId(id: string | null | undefined): id is string {
  return !!id && id !== TBD_TEAM_ID;
}

export async function syncKnockoutBracket(opts?: { force?: boolean }): Promise<KnockoutSyncResult> {
  const errors: string[] = [];
  const { complete, pending } = await getGroupCompletionStatus();
  const allGroupsComplete = pending.length === 0;

  let qualifiers: GroupQualifiers | null = null;
  if (allGroupsComplete || opts?.force) {
    try {
      const rows = await loadGroupStandings();
      if (rows.length >= 48) {
        qualifiers = rankGroupPositions(rows);
        if (
          qualifiers.combinationKey &&
          !(thirdPlaceMatrix as Record<string, unknown>)[qualifiers.combinationKey]
        ) {
          errors.push(`Combinación de terceros no encontrada en Annex C: ${qualifiers.combinationKey}`);
        }
      } else {
        errors.push(`Standings insuficientes (${rows.length}/48 filas esperadas)`);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const { data: existingMatches } = await supabase
    .from('matches')
    .select(
      'id,bracket_key,status,score_home,score_away,score_home_penalties,score_away_penalties,home_team_id,away_team_id,provider_match_id,kick_off'
    )
    .eq('provider', 'football_data');

  const matchByKey = new Map<string, DbMatch>();
  for (const m of existingMatches ?? []) {
    if (m.bracket_key) matchByKey.set(m.bracket_key, m as DbMatch);
  }

  let matchesUpserted = 0;
  const bracketReport: KnockoutSyncResult['bracket'] = [];

  for (const tpl of KNOCKOUT_MATCH_TEMPLATES) {
    const existing = (existingMatches ?? []).find(m => m.provider_match_id === tpl.providerMatchId);

    let homeTeamId: string | null = null;
    let awayTeamId: string | null = null;

    if (qualifiers) {
      homeTeamId = resolveGroupSlot(tpl.homeSource, qualifiers)?.teamId ?? null;
      awayTeamId = resolveGroupSlot(tpl.awaySource, qualifiers)?.teamId ?? null;
    }

    if (!homeTeamId) homeTeamId = resolveWinnerSlot(tpl.homeSource, matchByKey);
    if (!awayTeamId) awayTeamId = resolveWinnerSlot(tpl.awaySource, matchByKey);

    const homeResolved = isRealTeamId(homeTeamId);
    const awayResolved = isRealTeamId(awayTeamId);
    const resolved = homeResolved && awayResolved;
    const predictionsOpen = resolved;

    const row = {
      provider: 'football_data',
      provider_match_id: tpl.providerMatchId,
      bracket_key: tpl.bracketKey,
      bracket_home_source: tpl.homeSource,
      bracket_away_source: tpl.awaySource,
      home_team_placeholder: tpl.homePlaceholder,
      away_team_placeholder: tpl.awayPlaceholder,
      home_team_id: homeResolved ? homeTeamId : TBD_TEAM_ID,
      away_team_id: awayResolved ? awayTeamId : TBD_TEAM_ID,
      phase: tpl.phase,
      round: tpl.round,
      group_label: null,
      status: existing?.status ?? 'scheduled',
      kick_off: existing?.kick_off ?? '2026-06-28T19:00:00Z',
      is_locked: !predictionsOpen,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('matches').upsert(row, {
      onConflict: 'provider,provider_match_id',
    });
    if (error) {
      errors.push(`${tpl.bracketKey}: ${error.message}`);
    } else {
      matchesUpserted++;
      matchByKey.set(tpl.bracketKey, {
        id: existing?.id ?? '',
        bracket_key: tpl.bracketKey,
        status: row.status,
        score_home: existing?.score_home ?? null,
        score_away: existing?.score_away ?? null,
        score_home_penalties: existing?.score_home_penalties ?? null,
        score_away_penalties: existing?.score_away_penalties ?? null,
        home_team_id: row.home_team_id,
        away_team_id: row.away_team_id,
      });
    }

    bracketReport.push({
      bracketKey: tpl.bracketKey,
      homeTeamId: homeResolved ? homeTeamId : null,
      awayTeamId: awayResolved ? awayTeamId : null,
      homePlaceholder: tpl.homePlaceholder,
      awayPlaceholder: tpl.awayPlaceholder,
      resolved,
      predictionsOpen,
    });
  }

  if (qualifiers) {
    for (const tpl of KNOCKOUT_MATCH_TEMPLATES) {
      const m = matchByKey.get(tpl.bracketKey);
      if (!m?.id) continue;

      const homeId =
        resolveGroupSlot(tpl.homeSource, qualifiers)?.teamId ??
        resolveWinnerSlot(tpl.homeSource, matchByKey);
      const awayId =
        resolveGroupSlot(tpl.awaySource, qualifiers)?.teamId ??
        resolveWinnerSlot(tpl.awaySource, matchByKey);

      const homeOk = isRealTeamId(homeId);
      const awayOk = isRealTeamId(awayId);
      if (!homeOk && !awayOk) continue;

      await supabase
        .from('matches')
        .update({
          home_team_id: homeOk ? homeId : TBD_TEAM_ID,
          away_team_id: awayOk ? awayId : TBD_TEAM_ID,
          is_locked: !(homeOk && awayOk),
          updated_at: new Date().toISOString(),
        })
        .eq('id', m.id);
    }
  }

  return {
    ok: errors.length === 0,
    generatedAt: new Date().toISOString(),
    groupsComplete: complete,
    groupsPending: pending,
    allGroupsComplete,
    qualifiers,
    matchesUpserted,
    matchesResolved: bracketReport.filter(b => b.resolved).length,
    matchesPending: bracketReport.filter(b => !b.resolved).length,
    predictionsEnabled: bracketReport.filter(b => b.predictionsOpen).length,
    errors,
    bracket: bracketReport,
  };
}

export async function getKnockoutAuditReport(): Promise<KnockoutSyncResult & { auditNote: string }> {
  const errors: string[] = [];
  const { complete, pending } = await getGroupCompletionStatus();
  const allGroupsComplete = pending.length === 0;

  let qualifiers: GroupQualifiers | null = null;
  if (allGroupsComplete) {
    try {
      const rows = await loadGroupStandings();
      if (rows.length >= 48) {
        qualifiers = rankGroupPositions(rows);
        if (
          qualifiers.combinationKey &&
          !(thirdPlaceMatrix as Record<string, unknown>)[qualifiers.combinationKey]
        ) {
          errors.push(`Combinación de terceros no encontrada en Annex C: ${qualifiers.combinationKey}`);
        }
      } else {
        errors.push(`Standings insuficientes (${rows.length}/48 filas esperadas)`);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  const { data: existingMatches } = await supabase
    .from('matches')
    .select(
      'id,bracket_key,status,score_home,score_away,score_home_penalties,score_away_penalties,home_team_id,away_team_id,provider_match_id,home_team_placeholder,away_team_placeholder,is_locked'
    )
    .not('bracket_key', 'is', null);

  const matchByKey = new Map<string, DbMatch>();
  for (const m of existingMatches ?? []) {
    if (m.bracket_key) matchByKey.set(m.bracket_key, m as DbMatch);
  }

  const bracketReport: KnockoutSyncResult['bracket'] = KNOCKOUT_MATCH_TEMPLATES.map(tpl => {
    const db = (existingMatches ?? []).find(m => m.provider_match_id === tpl.providerMatchId);
    let homeTeamId = qualifiers ? resolveGroupSlot(tpl.homeSource, qualifiers)?.teamId ?? null : null;
    let awayTeamId = qualifiers ? resolveGroupSlot(tpl.awaySource, qualifiers)?.teamId ?? null : null;
    if (!homeTeamId) homeTeamId = resolveWinnerSlot(tpl.homeSource, matchByKey);
    if (!awayTeamId) awayTeamId = resolveWinnerSlot(tpl.awaySource, matchByKey);

    const homeResolved = isRealTeamId(homeTeamId) || isRealTeamId(db?.home_team_id);
    const awayResolved = isRealTeamId(awayTeamId) || isRealTeamId(db?.away_team_id);
    const resolved = homeResolved && awayResolved;

    return {
      bracketKey: tpl.bracketKey,
      homeTeamId: isRealTeamId(homeTeamId) ? homeTeamId : isRealTeamId(db?.home_team_id) ? db!.home_team_id : null,
      awayTeamId: isRealTeamId(awayTeamId) ? awayTeamId : isRealTeamId(db?.away_team_id) ? db!.away_team_id : null,
      homePlaceholder: db?.home_team_placeholder ?? tpl.homePlaceholder,
      awayPlaceholder: db?.away_team_placeholder ?? tpl.awayPlaceholder,
      resolved,
      predictionsOpen: resolved && db?.is_locked === false,
    };
  });

  return {
    ok: errors.length === 0,
    generatedAt: new Date().toISOString(),
    groupsComplete: complete,
    groupsPending: pending,
    allGroupsComplete,
    qualifiers,
    matchesUpserted: 0,
    matchesResolved: bracketReport.filter(b => b.resolved).length,
    matchesPending: bracketReport.filter(b => !b.resolved).length,
    predictionsEnabled: bracketReport.filter(b => b.predictionsOpen).length,
    errors,
    bracket: bracketReport,
    auditNote: allGroupsComplete
      ? 'Fase de grupos completa — clasificados calculados desde standings reales'
      : 'Fase de grupos en curso — placeholders conservados hasta cierre de grupos',
  };
}
