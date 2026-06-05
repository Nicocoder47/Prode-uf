import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  PLAYER_TRACE_SELECT,
  calculatePlayerDataQuality,
  computeTraceabilityScore,
  fieldCoverage,
  findDuplicateNameGroups,
  hasReliableExternalId,
  identityKeyDuplicates,
  playersWithoutExternalId,
  teamQualitySummary,
  topIncompletePlayers,
  type PlayerTraceRow,
} from '../src/services/footballData/playerDataQuality';

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

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false } },
);

async function fetchAllPlayers() {
  const pageSize = 1000;
  let offset = 0;
  const all: PlayerTraceRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select(PLAYER_TRACE_SELECT)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...(data as PlayerTraceRow[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

async function main() {
  let players: PlayerTraceRow[];
  try {
    players = await fetchAllPlayers();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const total = players.length;

  const { data: teams } = await supabase.from('teams').select('id,name');
  const teamNames = new Map((teams ?? []).map(t => [t.id, t.name]));

  for (const p of players) {
    if (p.data_quality_score == null || p.data_quality_score === 0) {
      p.data_quality_score = calculatePlayerDataQuality(p);
    }
  }

  const coverage = fieldCoverage(players);
  const incomplete = topIncompletePlayers(players, 50);
  const worstTeams = teamQualitySummary(players, teamNames).slice(0, 12);
  const duplicates = findDuplicateNameGroups(players);
  const noExternal = playersWithoutExternalId(players);

  const complete = players.filter(p => (p.data_quality_score ?? 0) >= 80).length;
  const pending = players.filter(p => p.enrichment_status === 'pending').length;
  const needsReview = players.filter(p => p.enrichment_status === 'needs_review').length;

  const missingRank = [...coverage].sort((a, b) => a.pct - b.pct);

  // ── Sprint V2: identidad y trazabilidad ──
  const verifiedIdentity = players.filter(p => p.verification_status === 'verified').length;
  const identityNeedsReview = players.filter(p => p.verification_status === 'needs_review').length;
  const identityConflict = players.filter(p => p.verification_status === 'conflict').length;
  const withoutExternal = players.filter(p => !hasReliableExternalId(p)).length;

  const traceScores = players.map(p => computeTraceabilityScore(p));
  const avgTraceability = Math.round(traceScores.reduce((s, x) => s + x, 0) / (traceScores.length || 1));
  const fullyTraceable = traceScores.filter(s => s >= 80).length;
  const traceablePct = Math.round((fullyTraceable / (players.length || 1)) * 1000) / 10;

  // cobertura por fuente
  const sourceCount = new Map<string, number>();
  for (const p of players) {
    for (const v of Object.values(p.data_sources ?? {})) {
      const src = typeof v === 'string' ? v : (v as { source?: string })?.source;
      if (src) sourceCount.set(src, (sourceCount.get(src) ?? 0) + 1);
    }
  }
  const coverageBySource = [...sourceCount.entries()].sort((a, b) => b[1] - a[1]);

  // cobertura por país
  const coverageByCountry = [...new Map(
    teamQualitySummary(players, teamNames).map(t => [t.teamName, t]),
  ).values()].map(t => ({ country: t.teamName, avgQuality: t.avgQuality, players: t.players }));

  const identityDupes = identityKeyDuplicates(players);
  const topConflicts = players
    .filter(p => (p.conflicted_fields ?? []).length > 0)
    .map(p => ({ name: p.name, conflicts: p.conflicted_fields }))
    .slice(0, 20);

  console.log('\n=== PRODEMUNDIAL — Player Data Quality Audit ===\n');
  console.log(`Total jugadores: ${total}\n`);

  for (const c of coverage) {
    console.log(`${c.field.padEnd(16)} ${String(c.count).padStart(5)} / ${total}  (${c.pct}%)`);
  }

  console.log('\n--- Resumen ---');
  console.log(`Completos (≥80): ${complete} (${((complete / total) * 100).toFixed(1)}%)`);
  console.log(`Pendientes enrich: ${pending}`);
  console.log(`Revisión manual: ${needsReview}`);
  console.log(`Sin external_id confiable: ${noExternal.length}`);
  console.log(`Grupos duplicados por nombre: ${duplicates.length}`);

  console.log('\n--- Identidad / Trazabilidad (V2) ---');
  console.log(`Identidad verificada: ${verifiedIdentity} (${((verifiedIdentity / total) * 100).toFixed(1)}%)`);
  console.log(`Identidad needs_review: ${identityNeedsReview}`);
  console.log(`Identidad conflict: ${identityConflict}`);
  console.log(`Sin external_id: ${withoutExternal}`);
  console.log(`traceability_score promedio: ${avgTraceability}`);
  console.log(`Datos realmente trazables (≥80): ${fullyTraceable} (${traceablePct}%)`);
  console.log(`Duplicados por identity_key: ${identityDupes.length}`);
  console.log('\n  Cobertura por fuente:');
  for (const [src, n] of coverageBySource) console.log(`   ${src.padEnd(18)} ${n}`);

  console.log('\n--- Campos más faltantes ---');
  for (const m of missingRank.slice(0, 5)) {
    console.log(`${m.field}: ${100 - m.pct}% faltante`);
  }

  console.log('\n--- Top 10 equipos con peor calidad ---');
  for (const t of worstTeams.slice(0, 10)) {
    console.log(`${t.teamName.padEnd(28)} avg=${t.avgQuality} incomplete=${t.incomplete}/${t.players}`);
  }

  console.log('\n--- Top 10 jugadores más incompletos ---');
  for (const p of incomplete.slice(0, 10)) {
    console.log(`${p.name.padEnd(30)} score=${p.score} missing=${p.missing}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    total,
    complete,
    pending,
    needsReview,
    coverage,
    worstTeams,
    topIncomplete: incomplete,
    duplicateGroups: duplicates,
    withoutExternalId: noExternal.length,
    missingFieldsRank: missingRank,
    identity: {
      verified: verifiedIdentity,
      needsReview: identityNeedsReview,
      conflict: identityConflict,
      withoutExternalId: withoutExternal,
      avgTraceability,
      traceablePct,
      fullyTraceable,
      identityDuplicates: identityDupes,
      topConflicts,
      coverageBySource,
      coverageByCountry,
    },
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/player-data-quality.json', JSON.stringify(report, null, 2));

  const needsReviewPlayers = players
    .filter(p => p.verification_status === 'needs_review' || p.verification_status === 'possible_match')
    .map(p => ({
      id: p.id,
      name: p.name,
      teamId: p.team_id,
      verificationStatus: p.verification_status,
      score: p.identity_confidence_score,
      candidate: p.identity_candidate,
      conflictedFields: p.conflicted_fields,
    }));
  writeFileSync('reports/player-needs-review.json', JSON.stringify(needsReviewPlayers, null, 2));

  const md = `# Player Data Quality Report

Generated: ${report.generatedAt}

## Totals
- Players: **${total}**
- Complete (≥80): **${complete}** (${((complete / total) * 100).toFixed(1)}%)
- Pending enrichment: **${pending}**
- Needs review: **${needsReview}**
- Without reliable external_id: **${noExternal.length}**

## Field Coverage

| Field | Count | % |
|-------|------:|--:|
${coverage.map(c => `| ${c.field} | ${c.count} | ${c.pct}% |`).join('\n')}

## Most Missing Fields
${missingRank.slice(0, 5).map(m => `- ${m.field}: ${100 - m.pct}% missing`).join('\n')}

## Worst Teams (by avg quality)
${worstTeams.slice(0, 10).map(t => `- ${t.teamName}: avg ${t.avgQuality}, ${t.incomplete}/${t.players} incomplete`).join('\n')}

## Top Incomplete Players
${incomplete.slice(0, 20).map(p => `- ${p.name} (score ${p.score}, missing ${p.missing})`).join('\n')}

## Identidad / Trazabilidad (V2)
- Identidad verificada: **${verifiedIdentity}** (${((verifiedIdentity / total) * 100).toFixed(1)}%)
- Needs review: **${identityNeedsReview}**
- Conflict: **${identityConflict}**
- Sin external_id: **${withoutExternal}**
- traceability_score promedio: **${avgTraceability}**
- Datos realmente trazables (≥80): **${fullyTraceable}** (${traceablePct}%)
- Duplicados por identidad: **${identityDupes.length}**

### Cobertura por fuente
${coverageBySource.map(([s, n]) => `- ${s}: ${n}`).join('\n')}

### Cobertura por país
${coverageByCountry.map(c => `- ${c.country}: avg ${c.avgQuality} (${c.players} jug.)`).join('\n')}
`;

  writeFileSync('reports/player-data-quality.md', md);
  console.log('\nReports written to reports/player-data-quality.json and .md\n');
}

main();
