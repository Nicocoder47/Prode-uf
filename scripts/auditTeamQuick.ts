import { readFileSync, existsSync } from 'node:fs';
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

const teamName = process.argv[2] ?? 'Argentina';

const sb = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { persistSession: false } },
);

async function main() {
  const { data: team } = await sb.from('teams').select('id,name,code').ilike('name', `%${teamName}%`).maybeSingle();
  if (!team) {
    console.log('Equipo no encontrado:', teamName);
    return;
  }
  console.log('Equipo:', team.name, team.id);

  const { data: players, error } = await sb
    .from('players')
    .select(
      'id,name,photo_url,club,market_value,rating,height,shirt_number,verification_status,enrichment_status,data_quality_score,api_football_id,thesportsdb_id,date_of_birth,nationality',
    )
    .eq('team_id', team.id)
    .order('name');

  if (error) throw error;
  const rows = players ?? [];
  const n = rows.length;
  const pct = (f: (p: (typeof rows)[0]) => boolean) => Math.round((rows.filter(f).length / (n || 1)) * 100);

  console.log(`Total jugadores: ${n}`);
  console.log(`Con foto: ${pct(p => !!p.photo_url)}%`);
  console.log(`Con club: ${pct(p => !!p.club)}%`);
  console.log(`Con market_value: ${pct(p => !!p.market_value)}%`);
  console.log(`Con rating: ${pct(p => !!p.rating && p.rating > 0)}%`);
  console.log(`Verificados: ${pct(p => p.verification_status === 'verified')}%`);
  console.log(`Con api_football_id: ${pct(p => !!p.api_football_id)}%`);
  console.log(`Avg quality: ${Math.round(rows.reduce((s, p) => s + (p.data_quality_score ?? 0), 0) / (n || 1))}`);

  console.log('\nMuestra (15):');
  for (const p of rows.slice(0, 15)) {
    console.log(
      `- ${p.name}: photo=${p.photo_url ? 'Y' : 'N'} club=${p.club ? 'Y' : 'N'} mv=${p.market_value ?? '-'} ver=${p.verification_status ?? 'null'} enrich=${p.enrichment_status ?? '-'}`,
    );
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
