/**
 * sync:players:enrich
 *
 * 1. Sincroniza planteles desde el proveedor ya integrado (API-Football / football-data)
 * 2. Enriquece campos faltantes con los providers existentes
 * 3. Genera reports/players-enrichment-report.json
 *
 * Uso:
 *   npm run sync:players:enrich
 *   npm run sync:players:enrich -- 120
 *   npm run sync:players:enrich -- 120 <teamId>
 *   npm run sync:players:enrich -- --skip-sync 120
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { supabase } from '../src/database/supabaseClient.js';
import { enrichPlayersBatch } from '../src/services/footballData/playerEnrichmentService.js';
import { resolveSportsDataProvider } from '../src/services/sync/DataProviderManager.js';
import { SyncEngine } from '../src/services/sync/SyncEngine.js';
import { fetchAllFromTable } from '../src/utils/supabasePaginate.js';

const REPORT_PATH = 'reports/players-enrichment-report.json';

type CoverageRow = {
  id: string;
  name: string;
  team_id: string | null;
  photo_url: string | null;
  date_of_birth: string | null;
  club: string | null;
  enrichment_status: string | null;
  verification_status: string | null;
  enrichment_error: string | null;
};

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

function parseArgs(argv: string[]) {
  const skipSync = argv.includes('--skip-sync');
  const nums = argv.filter(a => /^\d+$/.test(a));
  const limit = Number(nums[0] || process.env.ENRICH_PLAYERS_LIMIT || 100);
  const teamId = argv.find((a, i) => i > 0 && !a.startsWith('--') && !/^\d+$/.test(a) && argv[i - 1] !== '--team')
    ?? (argv.includes('--team') ? argv[argv.indexOf('--team') + 1] : undefined);
  return { skipSync, limit, teamId };
}

async function syncSquadsFromProvider() {
  const provider = resolveSportsDataProvider();
  console.log(`\n▶ Sincronizando planteles (${provider.name})...`);
  const players = await provider.syncPlayers();
  console.log(`  Jugadores normalizados: ${players.length}`);
  if (players.length === 0) {
    console.log('  ⚠ El proveedor no devolvió planteles. Continuando solo con enriquecimiento.');
    return { provider: provider.name, upserted: 0 };
  }
  await SyncEngine.upsertAndCache(
    'players',
    players,
    `cache:players:${provider.name}`,
    86400,
    'provider,provider_player_id',
  );
  console.log(`  ✔ Upserted: ${players.length}`);
  return { provider: provider.name, upserted: players.length };
}

async function buildCoverage() {
  const rows = await fetchAllFromTable<CoverageRow>(
    supabase,
    'players',
    'id,name,team_id,photo_url,date_of_birth,club,enrichment_status,verification_status,enrichment_error',
    { column: 'name', ascending: true },
  );

  const withoutPhoto: string[] = [];
  const withoutAge: string[] = [];
  const withoutClub: string[] = [];
  const conflicts: { id: string; name: string; reason: string }[] = [];
  const apiErrors: { id: string; name: string; error: string }[] = [];

  for (const p of rows) {
    if (isBlank(p.photo_url)) withoutPhoto.push(p.name);
    if (isBlank(p.date_of_birth)) withoutAge.push(p.name);
    if (isBlank(p.club)) withoutClub.push(p.name);
    if (p.enrichment_status === 'needs_review' || p.enrichment_status === 'rejected') {
      conflicts.push({ id: p.id, name: p.name, reason: p.enrichment_error ?? p.enrichment_status });
    }
    if (p.enrichment_status === 'error' && p.enrichment_error) {
      apiErrors.push({ id: p.id, name: p.name, error: p.enrichment_error });
    }
  }

  return {
    total: rows.length,
    withoutPhoto,
    withoutAge,
    withoutClub,
    conflicts,
    apiErrors,
  };
}

async function main() {
  const { skipSync, limit, teamId } = parseArgs(process.argv.slice(2));

  console.log('PRODEMUNDIAL · sync:players:enrich');
  console.log(`Enriquecimiento: API-Football + fallbacks ya integrados`);
  console.log(`Límite enrich: ${limit}${teamId ? ` · equipo: ${teamId}` : ''}${skipSync ? ' · sin sync previo' : ''}`);

  let syncResult: { provider: string; upserted: number } | null = null;
  let syncError: string | null = null;

  if (!skipSync) {
    try {
      syncResult = await syncSquadsFromProvider();
    } catch (err) {
      syncError = err instanceof Error ? err.message : String(err);
      console.error('⚠ Error en sync de planteles:', syncError);
    }
  }

  let run = { scanned: 0, updated: 0, needsReview: 0, rejected: 0, skipped: 0, errors: 0 };
  let runError: string | null = null;
  try {
    console.log('\n▶ Enriqueciendo jugadores...');
    run = await enrichPlayersBatch({ limit, teamId, maxPerRun: limit });
  } catch (err) {
    runError = err instanceof Error ? err.message : String(err);
    console.error('⚠ Error durante el enriquecimiento:', runError);
  }

  const coverage = await buildCoverage();

  const report = {
    generatedAt: new Date().toISOString(),
    provider: syncResult?.provider ?? 'enrichment-only',
    sync: {
      upserted: syncResult?.upserted ?? 0,
      error: syncError,
      skipped: skipSync,
    },
    run: {
      processed: run.scanned,
      updated: run.updated,
      needsReview: run.needsReview,
      rejected: run.rejected,
      skipped: run.skipped,
      errors: run.errors,
      fatalError: runError,
    },
    coverage: {
      totalPlayers: coverage.total,
      withoutPhoto: coverage.withoutPhoto.length,
      withoutAge: coverage.withoutAge.length,
      withoutClub: coverage.withoutClub.length,
      conflicts: coverage.conflicts.length,
      apiErrors: coverage.apiErrors.length,
    },
    details: {
      withoutPhoto: coverage.withoutPhoto.slice(0, 50),
      withoutAge: coverage.withoutAge.slice(0, 50),
      withoutClub: coverage.withoutClub.slice(0, 50),
      conflicts: coverage.conflicts.slice(0, 30),
      apiErrors: coverage.apiErrors.slice(0, 30),
    },
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n--- Resumen ---');
  if (syncResult) console.log(`Sync (${syncResult.provider}): ${syncResult.upserted} jugadores`);
  console.log(`Enriquecidos: ${run.updated} / ${run.scanned} procesados`);
  console.log(`Para revisar: ${run.needsReview} · Rechazados: ${run.rejected} · Saltados: ${run.skipped}`);
  console.log(`Errores enrich: ${run.errors}`);
  console.log('');
  console.log(`Cobertura total: ${coverage.total} jugadores`);
  console.log(`  Sin foto: ${coverage.withoutPhoto.length}`);
  console.log(`  Sin edad: ${coverage.withoutAge.length}`);
  console.log(`  Sin club: ${coverage.withoutClub.length}`);
  console.log(`  Conflictos: ${coverage.conflicts.length}`);
  console.log(`\n📄 Reporte: ${REPORT_PATH}`);
}

main().catch(err => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
