/**
 * Diagnóstico end-to-end: API → sync → Supabase para un partido.
 * Uso: npm run diagnose:match-sync -- --home=MEX --away=RSA --dry-run
 */
import { loadCloudEnv } from './lib/loadCloudEnv.js';
import { CLOUD_DEFAULTS } from './lib/loadCloudEnv.js';
import { FootballDataProvider } from '../src/providers/footballData/FootballDataProvider.js';
import { mapFootballDataStatus } from '../src/providers/footballData/normalizers.js';
import { todayInArgentina } from '../src/utils/matchDay.js';
import { supabase } from '../src/database/supabaseClient.js';
import { wouldUpdateMatch } from '../src/services/sync/matchSyncDiagnostics.js';
import { syncTodayMatchResultsFromApi } from '../src/services/sync/todayMatchResultsSync.js';

loadCloudEnv();

type Args = { home: string; away: string; dryRun: boolean };

function parseArgs(): Args {
  const home = process.argv.find(a => a.startsWith('--home='))?.split('=')[1] ?? 'MEX';
  const away = process.argv.find(a => a.startsWith('--away='))?.split('=')[1] ?? 'RSA';
  const dryRun = process.argv.includes('--dry-run');
  return { home: home.toUpperCase(), away: away.toUpperCase(), dryRun };
}

function fmtScore(h: number | null | undefined, a: number | null | undefined): string {
  return `${h ?? 'null'}-${a ?? 'null'}`;
}

async function main() {
  const args = parseArgs();
  const day = todayInArgentina();

  console.log('\n=== DIAGNÓSTICO SYNC PARTIDOS ===\n');
  console.log(`Proyecto: ${process.env.SUPABASE_URL ?? CLOUD_DEFAULTS.supabaseUrl}`);
  console.log(`Fecha (AR): ${day}`);
  console.log(`Partido: ${args.home} vs ${args.away}`);
  console.log(`FOOTBALL_DATA_API_KEY: ${FootballDataProvider.isConfigured() ? 'sí' : 'NO'}`);
  console.log(`API_FOOTBALL_KEY: ${process.env.API_FOOTBALL_KEY?.trim() ? 'sí' : 'NO'}\n`);

  const { data: teams } = await supabase
    .from('teams')
    .select('id,name,code,provider,provider_team_id,fifa_code')
    .in('code', [args.home, args.away]);

  console.log('--- EQUIPOS EN SUPABASE ---');
  for (const t of teams ?? []) {
    console.log(
      `  ${t.code} ${t.name}: provider=${t.provider} provider_team_id=${t.provider_team_id ?? 'NULL'}`,
    );
  }

  const homeTeam = teams?.find(t => t.code === args.home);
  const awayTeam = teams?.find(t => t.code === args.away);

  const { data: dbMatch } = await supabase
    .from('matches')
    .select('id,provider,provider_match_id,status,score_home,score_away,kick_off,updated_at')
    .eq('home_team_id', homeTeam?.id ?? '')
    .eq('away_team_id', awayTeam?.id ?? '')
    .order('kick_off', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('\n--- PARTIDO EN SUPABASE ---');
  if (!dbMatch) {
    console.log('  NO ENCONTRADO');
  } else {
    console.log(`  id: ${dbMatch.id}`);
    console.log(`  provider_match_id: ${dbMatch.provider_match_id ?? 'NULL'}`);
    console.log(`  status_db: ${dbMatch.status}`);
    console.log(`  score_db: ${fmtScore(dbMatch.score_home, dbMatch.score_away)}`);
    console.log(`  updated_at: ${dbMatch.updated_at}`);
  }

  let apiTarget: Record<string, unknown> | null = null;

  if (FootballDataProvider.isConfigured()) {
    console.log('\n--- API FOOTBALL-DATA (hoy) ---');
    try {
      const wc = process.env.FOOTBALL_DATA_WORLD_CUP_CODE || 'WC';
      const base = process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4';
      const apiKey = process.env.FOOTBALL_DATA_API_KEY!.trim();
      const res = await fetch(
        `${base}/competitions/${wc}/matches?dateFrom=${day}&dateTo=${day}`,
        { headers: { 'X-Auth-Token': apiKey } },
      );
      if (!res.ok) throw new Error(`football-data HTTP ${res.status}`);
      const body = (await res.json()) as { matches?: Record<string, unknown>[] };
      const today = body.matches ?? [];

      console.log(`  partidos_hoy_en_api: ${today.length}`);

      apiTarget =
        today.find(m => {
          const h = m.homeTeam as { tla?: string } | undefined;
          const a = m.awayTeam as { tla?: string } | undefined;
          return h?.tla === args.home && a?.tla === args.away;
        }) ?? null;

      if (!apiTarget) {
        console.log(`  partido ${args.home} vs ${args.away}: NO ENCONTRADO en API para ${day}`);
      } else {
        const score = apiTarget.score as { fullTime?: { home?: number; away?: number } } | undefined;
        const statusApi = String(apiTarget.status ?? 'SCHEDULED');
        const mappedStatus = mapFootballDataStatus(statusApi);
        console.log(`  provider_match_id: ${apiTarget.id}`);
        console.log(`  status_api: ${statusApi} (mapped: ${mappedStatus})`);
        console.log(`  score_api: ${fmtScore(score?.fullTime?.home, score?.fullTime?.away)}`);
      }
    } catch (err) {
      console.log(`  ERROR API: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    console.log('\n--- API FOOTBALL-DATA: sin API key ---');
  }

  console.log('\n--- DECISIÓN DE ACTUALIZACIÓN ---');
  if (!apiTarget) {
    console.log('  would_update: NO');
    console.log('  motivo: partido no encontrado en API para hoy');
  } else if (!dbMatch) {
    console.log('  would_update: SÍ');
    console.log('  motivo: partido nuevo — se crearía en upsert');
  } else {
    const score = apiTarget.score as { fullTime?: { home?: number | null; away?: number | null } } | undefined;
    const mappedStatus = mapFootballDataStatus(String(apiTarget.status ?? 'SCHEDULED'));
    const apiHome = score?.fullTime?.home ?? null;
    const apiAway = score?.fullTime?.away ?? null;
    const decision = wouldUpdateMatch(
      { status: mappedStatus, score_home: apiHome, score_away: apiAway },
      {
        status: dbMatch.status,
        score_home: dbMatch.score_home,
        score_away: dbMatch.score_away,
      },
    );
    console.log(`  would_update: ${decision.wouldUpdate ? 'SÍ' : 'NO'}`);
    console.log(`  motivo: ${decision.reason}`);
  }

  const { data: logs } = await supabase
    .from('data_sync_logs')
    .select('sync_type,status,records_upserted,records_skipped,error_message,started_at')
    .in('sync_type', ['live_matches', 'today_results', 'live_cycle'])
    .order('started_at', { ascending: false })
    .limit(8);

  console.log('\n--- ÚLTIMOS SYNC LOGS ---');
  for (const log of logs ?? []) {
    console.log(
      `  ${log.started_at} ${log.sync_type} ${log.status} upserted=${log.records_upserted} skipped=${log.records_skipped ?? 0} ${log.error_message?.slice(0, 80) ?? ''}`,
    );
  }

  if (!args.dryRun && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.log('\n--- EJECUTANDO syncTodayMatchResultsFromApi ---');
    const result = await syncTodayMatchResultsFromApi();
    console.log(JSON.stringify({ ...result, diagnostics: result.diagnostics.slice(0, 5) }, null, 2));

    const { data: after } = await supabase
      .from('matches')
      .select('status,score_home,score_away,updated_at')
      .eq('id', dbMatch?.id ?? '')
      .maybeSingle();

    console.log('\n--- PARTIDO DESPUÉS DEL SYNC ---');
    if (after) {
      console.log(
        `  status_db: ${after.status} score_db: ${fmtScore(after.score_home, after.score_away)} updated_at: ${after.updated_at}`,
      );
    }
  } else if (!args.dryRun) {
    console.log('\n--- SYNC: omitido (falta SUPABASE_SERVICE_ROLE_KEY) ---');
  }

  console.log('\n=== FIN DIAGNÓSTICO ===\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
