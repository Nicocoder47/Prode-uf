import { readFileSync } from 'node:fs';
import { createNodeSupabaseClient } from './lib/supabaseNodeClient.js';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('NO_CREDS');
  process.exit(0);
}

const supabase = createNodeSupabaseClient(url, key);

async function main() {
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id,name,code,group_label')
    .order('name');
  if (error) throw error;

  console.log('TOTAL', teams?.length);

  const { data: standings } = await supabase.from('standings').select('team_id, group_label');
  const standMap = new Map((standings ?? []).map((s) => [s.team_id, s.group_label]));

  const final = JSON.parse(readFileSync('reports/countries-final.json', 'utf8')) as {
    teams: { fifaCode: string; name: string }[];
  };
  const official = new Set(final.teams.map((c) => c.fifaCode.toUpperCase()));

  for (const t of teams ?? []) {
    const inOfficial = t.code ? official.has(t.code.toUpperCase()) : false;
    const standGroup = standMap.get(t.id);
    if (!inOfficial || t.name?.toLowerCase().includes('definir')) {
      console.log('EXCLUDE', t.name, t.code, 'group=', t.group_label, 'stand=', standGroup);
    }
  }

  const notInDb = final.teams.filter(
    (c) => !teams?.some((t) => t.code?.toUpperCase() === c.fifaCode.toUpperCase()),
  );
  if (notInDb.length) console.log('MISSING', notInDb.map((c) => c.fifaCode).join(', '));

  const dupGroups: Record<string, string[]> = {};
  for (const t of teams ?? []) {
    const g = standMap.get(t.id) ?? t.group_label ?? '?';
    (dupGroups[g] ??= []).push(t.code ?? t.name);
  }
  for (const [g, arr] of Object.entries(dupGroups).sort()) {
    if (g !== '?' && arr.length !== 4) console.log('GROUP_SIZE', g, arr.length, arr.join(','));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
