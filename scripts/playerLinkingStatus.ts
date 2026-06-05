import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile('.env');

const sb = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false } },
);

type PlayerRow = {
  id: string;
  name: string;
  team_id: string;
  photo_url: string | null;
  club: string | null;
  market_value: number | null;
  verification_status: string | null;
  identity_confidence_score: number | null;
  enrichment_status: string | null;
  data_quality_score: number | null;
  api_football_id: string | null;
  thesportsdb_id: string | null;
  identity_candidate: { source?: string; score?: number; name?: string } | null;
  conflicted_fields: string[] | null;
};

async function fetchAllPlayers(): Promise<PlayerRow[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: PlayerRow[] = [];
  const select =
    'id,name,team_id,photo_url,club,market_value,verification_status,identity_confidence_score,enrichment_status,data_quality_score,api_football_id,thesportsdb_id,identity_candidate,conflicted_fields';

  while (true) {
    const { data, error } = await sb.from('players').select(select).range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as PlayerRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function main() {
  const [players, teamsRes, countriesRes] = await Promise.all([
    fetchAllPlayers(),
    sb.from('teams').select('id,name,code,verification_status,fifa_code,iso3').order('name'),
    sb.from('teams').select('verification_status,fifa_code,iso3'),
  ]);

  const teams = teamsRes.data ?? [];
  const teamMap = new Map(teams.map(t => [t.id, t.name]));
  const total = players.length;

  const byStatus = (s: string) => players.filter(p => (p.verification_status ?? 'unlinked') === s);
  const pct = (n: number) => Math.round((n / (total || 1)) * 1000) / 10;

  const verified = byStatus('verified');
  const needsReview = byStatus('needs_review');
  const possibleMatch = byStatus('possible_match');
  const conflict = byStatus('conflict');
  const rejected = byStatus('rejected');
  const unlinked = players.filter(p => !p.verification_status || p.verification_status === 'unlinked');

  const withPhoto = players.filter(p => !!p.photo_url);
  const withClub = players.filter(p => !!p.club);
  const withExternal = players.filter(p => !!p.api_football_id || !!p.thesportsdb_id);
  const verifiedNoPhoto = verified.filter(p => !p.photo_url);

  console.log('\n=== STATUS JUGADORES Y VINCULACIONES ===\n');
  console.log(`Total jugadores: ${total}\n`);

  console.log('--- Identidad (verification_status) ---');
  console.log(`  verified:        ${verified.length} (${pct(verified.length)}%)`);
  console.log(`  needs_review:    ${needsReview.length} (${pct(needsReview.length)}%)`);
  console.log(`  possible_match:  ${possibleMatch.length} (${pct(possibleMatch.length)}%)`);
  console.log(`  conflict:        ${conflict.length} (${pct(conflict.length)}%)`);
  console.log(`  rejected:        ${rejected.length} (${pct(rejected.length)}%)`);
  console.log(`  unlinked:        ${unlinked.length} (${pct(unlinked.length)}%)`);

  console.log('\n--- Cobertura de datos ---');
  console.log(`  Con foto:              ${withPhoto.length} (${pct(withPhoto.length)}%)`);
  console.log(`  Con club:              ${withClub.length} (${pct(withClub.length)}%)`);
  console.log(`  Con external_id:       ${withExternal.length} (${pct(withExternal.length)}%)`);
  console.log(`  Verificados sin foto:  ${verifiedNoPhoto.length}`);

  console.log('\n--- Enrichment ---');
  const enrichCounts = new Map<string, number>();
  for (const p of players) {
    const s = p.enrichment_status ?? 'null';
    enrichCounts.set(s, (enrichCounts.get(s) ?? 0) + 1);
  }
  for (const [s, n] of [...enrichCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${n}`);
  }

  console.log('\n--- Países / Selecciones (teams) ---');
  const countryRows = countriesRes.data ?? [];
  const cVerified = countryRows.filter(t => t.verification_status === 'verified').length;
  const cReview = countryRows.filter(t => t.verification_status === 'needs_review').length;
  const cConflict = countryRows.filter(t => t.verification_status === 'conflict').length;
  const cUnlinked = countryRows.filter(t => !t.verification_status || t.verification_status === 'unlinked').length;
  const cNoCodes = countryRows.filter(t => !t.fifa_code || !t.iso3).length;
  console.log(`  Total selecciones: ${countryRows.length}`);
  console.log(`  verified: ${cVerified} | needs_review: ${cReview} | conflict: ${cConflict} | unlinked: ${cUnlinked}`);
  console.log(`  Sin fifa_code/iso3: ${cNoCodes}`);

  console.log('\n--- Por selección (peor cobertura primero) ---');
  console.log('Selección'.padEnd(22) + 'Jug'.padStart(4) + 'Ver%'.padStart(6) + 'Foto%'.padStart(7) + 'SinVínc'.padStart(8) + 'SinFoto'.padStart(8));
  console.log('-'.repeat(55));

  const teamStats = teams.map(t => {
    const list = players.filter(p => p.team_id === t.id);
    const n = list.length || 1;
    const ver = list.filter(p => p.verification_status === 'verified').length;
    const photos = list.filter(p => p.photo_url).length;
    const noLink = list.filter(p => !p.verification_status || p.verification_status === 'unlinked').length;
    const noPhoto = list.filter(p => !p.photo_url).length;
    return {
      name: t.name,
      players: list.length,
      verPct: Math.round((ver / n) * 100),
      photoPct: Math.round((photos / n) * 100),
      noLink,
      noPhoto,
    };
  }).sort((a, b) => a.photoPct - b.photoPct || a.verPct - b.verPct);

  for (const t of teamStats) {
    console.log(
      t.name.padEnd(22) +
        String(t.players).padStart(4) +
        `${t.verPct}%`.padStart(6) +
        `${t.photoPct}%`.padStart(7) +
        String(t.noLink).padStart(8) +
        String(t.noPhoto).padStart(8),
    );
  }

  console.log('\n--- Pendientes de revisión manual (needs_review, top 15) ---');
  for (const p of needsReview.sort((a, b) => (b.identity_confidence_score ?? 0) - (a.identity_confidence_score ?? 0)).slice(0, 15)) {
    const cand = p.identity_candidate;
    console.log(
      `  ${p.name} (${teamMap.get(p.team_id)}) score=${p.identity_confidence_score} provider=${cand?.source ?? '-'} candidato=${cand?.name ?? '-'}`,
    );
  }

  console.log('\n--- Sin vínculo / sin candidatos (muestra 15) ---');
  for (const p of unlinked.slice(0, 15)) {
    console.log(`  ${p.name} (${teamMap.get(p.team_id)}) score=${p.identity_confidence_score ?? 0}`);
  }

  console.log('\n--- Conflictos (muestra 10) ---');
  for (const p of conflict.slice(0, 10)) {
    console.log(
      `  ${p.name} (${teamMap.get(p.team_id)}) campos=${(p.conflicted_fields ?? []).join(', ') || '-'}`,
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalPlayers: total,
    identity: {
      verified: verified.length,
      needsReview: needsReview.length,
      possibleMatch: possibleMatch.length,
      conflict: conflict.length,
      rejected: rejected.length,
      unlinked: unlinked.length,
    },
    coverage: {
      withPhoto: withPhoto.length,
      withClub: withClub.length,
      withExternalId: withExternal.length,
      verifiedNoPhoto: verifiedNoPhoto.length,
    },
    countries: {
      total: countryRows.length,
      verified: cVerified,
      needsReview: cReview,
      conflict: cConflict,
      unlinked: cUnlinked,
      missingCodes: cNoCodes,
    },
    byTeam: teamStats,
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/player-linking-status.json', JSON.stringify(report, null, 2));
  console.log('\nReporte JSON: reports/player-linking-status.json\n');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
