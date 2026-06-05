import axios from 'axios';
import { readFileSync, existsSync } from 'node:fs';

function loadEnv(path: string) {
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

loadEnv('.env');
loadEnv('.env.local');

const API_URL = 'https://v3.football.api-sports.io';
const HEADERS = {
  'x-rapidapi-host': 'v3.football.api-sports.io',
  'x-rapidapi-key': process.env.API_FOOTBALL_KEY || '',
};
const LEAGUE_ID = process.env.API_FOOTBALL_WORLD_CUP_LEAGUE_ID || '1';
const SEASON = process.env.API_FOOTBALL_WORLD_CUP_SEASON || '2026';

async function checkApi() {
  console.log('🔍 Iniciando auditoría de API-Football...');
  console.log(`📡 League ID configurado: ${LEAGUE_ID} | Season: ${SEASON}\n`);

  if (!HEADERS['x-rapidapi-key'] || HEADERS['x-rapidapi-key'] === 'your_api_football_key_here') {
    console.error('❌ ERROR: API_FOOTBALL_KEY no configurada. Revisá tu archivo .env');
    process.exit(1);
  }

  try {
    const leagueRes = await axios.get(`${API_URL}/leagues?id=${LEAGUE_ID}&season=${SEASON}`, { headers: HEADERS });
    if (leagueRes.data.results === 0) {
      console.warn(`⚠️ API-Football todavía no expone datos completos para la temporada ${SEASON}.`);
      console.warn(`💡 SUGERENCIA: Usa API_FOOTBALL_WORLD_CUP_SEASON=2022 en tu .env para modo test.`);
      process.exit(0);
    }
    console.log(`✅ Liga detectada: ${leagueRes.data.response[0].league.name}`);

    const teamsRes = await axios.get(`${API_URL}/teams?league=${LEAGUE_ID}&season=${SEASON}`, { headers: HEADERS });
    console.log(`✅ Teams count: ${teamsRes.data.results}`);

    const fixturesRes = await axios.get(`${API_URL}/fixtures?league=${LEAGUE_ID}&season=${SEASON}`, { headers: HEADERS });
    console.log(`✅ Fixture count: ${fixturesRes.data.results}`);

    const venues = new Set(fixturesRes.data.response.map((f: { fixture: { venue: { id: number } } }) => f.fixture.venue.id).filter(Boolean));
    console.log(`✅ Stadiums available: ${venues.size}`);

    console.log('\n🚀 API validada. Lista para ejecutar npm run sync:all');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error de conexión con API-Football:', msg);
    process.exit(1);
  }
}

checkApi();
