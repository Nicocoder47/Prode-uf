import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FootballDataProvider,
  FootballDataHttpError,
} from '../src/providers/footballData/FootballDataProvider';

const OUT_DIR = join(process.cwd(), 'debug', 'football-data');

function saveJson(name: string, data: unknown) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2), 'utf8');
}

async function main() {
  console.log('🔍 football-data.org — diagnóstico de cobertura\n');

  if (!FootballDataProvider.isConfigured()) {
    console.error('❌ FOOTBALL_DATA_API_KEY no configurada en .env');
    process.exit(1);
  }

  const base = process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4';
  const wc = process.env.FOOTBALL_DATA_WORLD_CUP_CODE || 'WC';

  try {
    const competitions = await FootballDataProvider.fetchCompetitions();
    saveJson('competitions.json', competitions.data);
    console.log(`GET ${base}/competitions → ${competitions.status}`);

    const worldcup = await FootballDataProvider.fetchWorldCup();
    saveJson('worldcup.json', worldcup.data);
    console.log(`GET ${base}/competitions/${wc} → ${worldcup.status}`);

    const matches = await FootballDataProvider.fetchMatchesRaw();
    saveJson('matches.json', matches.data);
    console.log(`GET ${base}/competitions/${wc}/matches → ${matches.status}`);

    const teams = await FootballDataProvider.fetchTeamsRaw();
    saveJson('teams.json', teams.data);
    console.log(`GET ${base}/competitions/${wc}/teams → ${teams.status}`);

    const standings = await FootballDataProvider.fetchStandingsRaw();
    saveJson('standings.json', standings.data);
    console.log(`GET ${base}/competitions/${wc}/standings → ${standings.status}`);

    const wcData = worldcup.data as { name?: string; code?: string };
    const teamsList = (teams.data as { teams?: unknown[] }).teams ?? [];
    const matchesList = (matches.data as { matches?: unknown[] }).matches ?? [];
    const standingsList = (standings.data as { standings?: unknown[] }).standings ?? [];

    let squadsAvailable = false;
    let playersCount = 0;
    for (const t of teamsList as { squad?: unknown[] }[]) {
      const squad = t.squad ?? [];
      if (squad.length > 0) {
        squadsAvailable = true;
        playersCount += squad.length;
      }
    }

    console.log('\n--- Resumen ---');
    console.log(`Competition detected: ${wcData.name ?? wc} (${wcData.code ?? wc})`);
    console.log(`Teams count: ${teamsList.length}`);
    console.log(`Matches count: ${matchesList.length}`);
    console.log(`Standings count: ${standingsList.length}`);
    console.log(`Squads available: ${squadsAvailable ? 'yes' : 'no'}`);
    console.log(`Players available: ${playersCount > 0 ? `yes (${playersCount})` : 'no'}`);

    if (!squadsAvailable || playersCount === 0) {
      console.log('\nfootball-data.org no devuelve squads/players para este plan o esta competencia.');
      console.log('Usar TheSportsDB o fuente secundaria para fotos y planteles.');
    }

    console.log(`\nJSON guardados en ${OUT_DIR}`);
  } catch (err) {
    if (err instanceof FootballDataHttpError && err.status === 429) {
      console.error('Rate limit detected.');
      console.error(`Retry after: ${err.retryAfter ?? 'unknown'}`);
    } else {
      console.error('Error:', err);
    }
    process.exit(1);
  }
}

main();
