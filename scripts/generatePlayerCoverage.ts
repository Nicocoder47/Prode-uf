/**
 * Fase 8 — Cobertura jugadores → reports/player-coverage.json
 * npm run audit:player-coverage
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { supabase } from '../src/database/supabaseClient.js';
import { fetchAllFromTable } from '../src/utils/supabasePaginate.js';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (.env.cloud)');
    process.exit(1);
  }

  const rows = await fetchAllFromTable<{
    id: string;
    photo_url: string | null;
    date_of_birth: string | null;
    club: string | null;
    provider_player_id: string | null;
    verification_status: string | null;
    enrichment_status: string | null;
  }>(supabase, 'players', 'id,photo_url,date_of_birth,club,provider_player_id,verification_status,enrichment_status');

  const total = rows.length;

  const withPhoto = rows.filter(p => !!p.photo_url?.trim()).length;
  const withAge = rows.filter(p => !!p.date_of_birth).length;
  const withClub = rows.filter(p => !!p.club?.trim()).length;
  const withProviderId = rows.filter(p => !!p.provider_player_id?.trim()).length;
  const verified = rows.filter(p => p.verification_status === 'verified').length;

  const { data: ratingRows } = await supabase.from('player_ratings').select('player_id');
  const playersWithStats = new Set((ratingRows ?? []).map(r => r.player_id)).size;

  const report = {
    generatedAt: new Date().toISOString(),
    source: url.replace(/\/\/.*@/, '//***@'),
    summary: {
      total,
      withPhoto,
      withPhotoPct: pct(withPhoto, total),
      withAge,
      withAgePct: pct(withAge, total),
      withClub,
      withClubPct: pct(withClub, total),
      withStats: playersWithStats,
      withStatsPct: pct(playersWithStats, total),
      withProviderId,
      withProviderIdPct: pct(withProviderId, total),
      verified,
      verifiedPct: pct(verified, total),
    },
    enrichment: {
      pending: rows.filter(p => p.enrichment_status === 'pending').length,
      complete: rows.filter(p => p.enrichment_status === 'complete').length,
      error: rows.filter(p => p.enrichment_status === 'error').length,
    },
    gaps: {
      missingPhoto: rows.filter(p => !p.photo_url?.trim()).slice(0, 20).map(p => p.id),
      missingAge: rows.filter(p => !p.date_of_birth).slice(0, 20).map(p => p.id),
      missingClub: rows.filter(p => !p.club?.trim()).slice(0, 20).map(p => p.id),
    },
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/player-coverage.json', JSON.stringify(report, null, 2));
  console.log(`Player coverage → reports/player-coverage.json (${total} jugadores)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
