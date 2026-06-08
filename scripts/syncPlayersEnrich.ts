/**
 * sync:players:enrich
 *
 * Por defecto: solo enriquece (sin re-sync de planteles), modo rápido, lote de 20.
 *
 * Uso:
 *   npm run sync:players:enrich
 *   npm run sync:players:enrich -- 50
 *   npm run sync:players:enrich -- --with-sync 50
 *   npm run sync:players:enrich -- --full 10   (incluye TheSportsDB/Wikimedia)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { supabase } from '../src/database/supabaseClient.js';
import { enrichPlayersBatch } from '../src/services/footballData/playerEnrichmentService.js';
import { resolveSportsDataProvider } from '../src/services/sync/DataProviderManager.js';
import { SyncEngine } from '../src/services/sync/SyncEngine.js';

// Modo rápido por defecto — evita horas de APIs externas
if (!process.env.PLAYER_ENRICH_FAST && !process.argv.includes('--full')) {
  process.env.PLAYER_ENRICH_FAST = '1';
}
if (!process.env.PLAYER_ENRICH_DELAY_MS) {
  process.env.PLAYER_ENRICH_DELAY_MS = '0';
}

const REPORT_PATH = 'reports/players-enrichment-report.json';

function parseArgs(argv: string[]) {
  const withSync = argv.includes('--with-sync');
  const skipSync = argv.includes('--skip-sync') || !withSync;
  const nums = argv.filter(a => /^\d+$/.test(a));
  const limit = Number(nums[0] || process.env.ENRICH_PLAYERS_LIMIT || 20);
  const teamId = argv.find((a, i) => i > 0 && !a.startsWith('--') && !/^\d+$/.test(a) && argv[i - 1] !== '--team')
    ?? (argv.includes('--team') ? argv[argv.indexOf('--team') + 1] : undefined);
  return { skipSync, limit, teamId, fast: !argv.includes('--full') };
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
  console.log('\n▶ Calculando cobertura…');
  const t0 = Date.now();

  const [totalRes, photoRes, ageRes, clubRes, conflictRes, errorRes] = await Promise.all([
    supabase.from('players').select('id', { count: 'exact', head: true }),
    supabase.from('players').select('id', { count: 'exact', head: true }).is('photo_url', null),
    supabase.from('players').select('id', { count: 'exact', head: true }).is('date_of_birth', null),
    supabase.from('players').select('id', { count: 'exact', head: true }).is('club', null),
    supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .in('enrichment_status', ['needs_review', 'rejected']),
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('enrichment_status', 'error'),
  ]);

  const total = totalRes.count ?? 0;
  console.log(`  Cobertura calculada en ${Date.now() - t0}ms`);

  return {
    total,
    withoutPhoto: photoRes.count ?? 0,
    withoutAge: ageRes.count ?? 0,
    withoutClub: clubRes.count ?? 0,
    conflicts: conflictRes.count ?? 0,
    apiErrors: errorRes.count ?? 0,
    withoutPhotoNames: [] as string[],
    withoutAgeNames: [] as string[],
    withoutClubNames: [] as string[],
    conflictRows: [] as { id: string; name: string; reason: string }[],
    apiErrorRows: [] as { id: string; name: string; error: string }[],
  };
}

async function main() {
  const { skipSync, limit, teamId, fast } = parseArgs(process.argv.slice(2));

  console.log('PRODEMUNDIAL · sync:players:enrich');
  console.log(`Modo: ${fast ? 'rápido (solo API-Football/Sportmonks)' : 'completo (todas las APIs)'}`);
  console.log(`Límite: ${limit}${teamId ? ` · equipo: ${teamId}` : ''}${skipSync ? ' · sin re-sync planteles' : ' · con re-sync planteles'}`);

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
    run = await enrichPlayersBatch({ limit, teamId, maxPerRun: limit, delayMs: Number(process.env.PLAYER_ENRICH_DELAY_MS || 0) });
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
      withoutPhoto: coverage.withoutPhoto,
      withoutAge: coverage.withoutAge,
      withoutClub: coverage.withoutClub,
      conflicts: coverage.conflicts,
      apiErrors: coverage.apiErrors,
    },
    details: {
      withoutPhoto: coverage.withoutPhotoNames.slice(0, 50),
      withoutAge: coverage.withoutAgeNames.slice(0, 50),
      withoutClub: coverage.withoutClubNames.slice(0, 50),
      conflicts: coverage.conflictRows.slice(0, 30),
      apiErrors: coverage.apiErrorRows.slice(0, 30),
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
  console.log(`  Sin foto: ${coverage.withoutPhoto}`);
  console.log(`  Sin edad: ${coverage.withoutAge}`);
  console.log(`  Sin club: ${coverage.withoutClub}`);
  console.log(`  Conflictos: ${coverage.conflicts}`);
  console.log(`\n📄 Reporte: ${REPORT_PATH}`);
}

main().catch(err => {
  console.error('❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
