import axios from 'axios';
import { readFileSync, existsSync } from 'node:fs';

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

async function main() {
  console.log('PRODEMUNDIAL validate:api\n');
  let failed = 0;

  const fdKey = process.env.FOOTBALL_DATA_API_KEY;
  const fdBase = process.env.FOOTBALL_DATA_BASE_URL || 'https://api.football-data.org/v4';
  const wc = process.env.FOOTBALL_DATA_WORLD_CUP_CODE || 'WC';

  if (!fdKey) {
    console.error('FAIL football-data — FOOTBALL_DATA_API_KEY missing');
    failed++;
  } else {
    try {
      const res = await axios.get(`${fdBase}/competitions/${wc}/teams`, {
        headers: { 'X-Auth-Token': fdKey },
        validateStatus: () => true,
      });
      if (res.status === 200) {
        const n = (res.data?.teams ?? []).length;
        console.log(`OK   football-data teams — ${n} equipos (status ${res.status})`);
        const remaining = res.headers['x-requests-available-minute'] ?? res.headers['x-ratelimit-remaining'];
        if (remaining) console.log(`     requests/min restantes: ${remaining}`);
      } else {
        console.error(`FAIL football-data — HTTP ${res.status}`);
        failed++;
      }
    } catch (e) {
      console.error('FAIL football-data —', e instanceof Error ? e.message : e);
      failed++;
    }
  }

  const afKey = process.env.API_FOOTBALL_KEY;
  const afBase = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';

  if (!afKey || afKey === 'your_api_football_key_here') {
    console.log('SKIP API-Football — API_FOOTBALL_KEY not configured (optional enrichment)');
  } else {
    try {
      const res = await axios.get(`${afBase}/status`, {
        headers: {
          'x-rapidapi-host': 'v3.football.api-sports.io',
          'x-rapidapi-key': afKey,
        },
        validateStatus: () => true,
      });
      if (res.status === 200) {
        const account = res.data?.response?.account;
        const requests = res.data?.response?.requests;
        console.log(`OK   API-Football status — plan ${account?.plan ?? '?'}, daily ${requests?.current ?? '?'}/${requests?.limit_day ?? '?'}`);
      } else {
        console.error(`FAIL API-Football — HTTP ${res.status}`);
        failed++;
      }
    } catch (e) {
      console.error('FAIL API-Football —', e instanceof Error ? e.message : e);
      failed++;
    }
  }

  console.log('\n--- Summary ---');
  if (failed === 0) {
    console.log('API validation passed.');
    process.exit(0);
  }
  console.log(`${failed} provider(s) failed.`);
  process.exit(1);
}

main();
