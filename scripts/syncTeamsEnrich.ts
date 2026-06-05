/**
 * sync:teams:enrich
 *
 * Enriquece equipos del Mundial con datos reales del proveedor integrado:
 * - DT (coach) vía API-Football /coachs
 * - Confederación vía referencia FIFA a partir del país/nombre de la API
 *
 * No inventa ranking FIFA si la API no lo expone.
 *
 * Uso:
 *   npm run sync:teams:enrich
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { supabase } from '../src/database/supabaseClient.js';
import { ApiFootballProvider } from '../src/providers/apiFootball/ApiFootballProvider.js';
import { resolveTeamConfederation } from '../src/utils/teamMetadata.js';
import { fetchAllFromTable } from '../src/utils/supabasePaginate.js';

const REPORT_PATH = 'reports/teams-enrichment-report.json';

type TeamRow = {
  id: string;
  name: string;
  code: string | null;
  country_code: string | null;
  coach: string | null;
  confederation: string | null;
  fifa_ranking: number | null;
  provider: string | null;
};

async function buildCoverage(teams: TeamRow[]) {
  const withoutCoach: string[] = [];
  const withoutConfederation: string[] = [];
  const withoutRanking: string[] = [];

  for (const t of teams) {
    if (!t.coach?.trim()) withoutCoach.push(t.name);
    if (!t.confederation?.trim()) withoutConfederation.push(t.name);
    if (t.fifa_ranking == null) withoutRanking.push(t.name);
  }

  return { withoutCoach, withoutConfederation, withoutRanking };
}

async function enrichConfederationOnly() {
  const { data, error } = await supabase
    .from('teams')
    .select('id,name,code,country_code,confederation');
  if (error) throw error;

  let updated = 0;
  for (const row of data ?? []) {
    if (row.confederation?.trim()) continue;
    const conf = resolveTeamConfederation(row.name, row.code, row.country_code);
    if (!conf) continue;
    const { error: upErr } = await supabase
      .from('teams')
      .update({ confederation: conf, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (!upErr) updated++;
  }
  return updated;
}

async function main() {
  console.log('PRODEMUNDIAL · sync:teams:enrich\n');

  let coachResult = { updated: 0, coaches: 0, confederations: 0 };
  let coachError: string | null = null;

  if (ApiFootballProvider.isConfigured()) {
    try {
      console.log('▶ Enriqueciendo DT y confederación (API-Football)...');
      coachResult = await ApiFootballProvider.enrichStoredTeamsMetadata();
    } catch (err) {
      coachError = err instanceof Error ? err.message : String(err);
      console.error('⚠ Error API-Football:', coachError);
    }
  } else {
    console.log('⚠ API_FOOTBALL_KEY no configurada. Solo confederación por referencia.');
  }

  console.log('▶ Completando confederaciones faltantes...');
  const confOnly = await enrichConfederationOnly();

  const teams = await fetchAllFromTable<TeamRow>(supabase, 'teams', 'id,name,code,country_code,coach,confederation,fifa_ranking,provider', {
    column: 'name',
    ascending: true,
  });
  const coverage = await buildCoverage(teams);

  const report = {
    generatedAt: new Date().toISOString(),
    provider: ApiFootballProvider.isConfigured() ? 'api-football' : 'reference-only',
    run: {
      teamsUpdated: coachResult.updated + confOnly,
      coachesAdded: coachResult.coaches,
      confederationsAdded: coachResult.confederations + confOnly,
      error: coachError,
    },
    coverage: {
      totalTeams: teams.length,
      withoutCoach: coverage.withoutCoach.length,
      withoutConfederation: coverage.withoutConfederation.length,
      withoutFifaRanking: coverage.withoutRanking.length,
    },
    details: {
      withoutCoach: coverage.withoutCoach.slice(0, 50),
      withoutConfederation: coverage.withoutConfederation.slice(0, 50),
      withoutFifaRanking: coverage.withoutRanking.slice(0, 50),
    },
    note: 'Ranking FIFA solo se persiste si el proveedor lo expone. API-Football no publica ranking FIFA mundial en este plan.',
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n--- Resumen ---');
  console.log(`Equipos actualizados: ${report.run.teamsUpdated}`);
  console.log(`DT agregados: ${report.run.coachesAdded}`);
  console.log(`Confederaciones: ${report.run.confederationsAdded}`);
  console.log(`Sin DT: ${coverage.withoutCoach.length}`);
  console.log(`Sin confederación: ${coverage.withoutConfederation.length}`);
  console.log(`Sin ranking FIFA: ${coverage.withoutRanking.length}`);
  console.log(`\n📄 Reporte: ${REPORT_PATH}`);
}

main().catch(err => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
