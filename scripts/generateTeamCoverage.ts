/**
 * Fase 8 — Cobertura equipos → reports/team-coverage.json
 * npm run audit:team-coverage
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { loadCloudEnv } from './lib/loadCloudEnv.js';

loadCloudEnv();

type TeamRow = {
  id: string;
  name: string;
  code: string | null;
  country_code: string | null;
  coach: string | null;
  confederation: string | null;
  fifa_ranking: number | null;
  flag_url: string | null;
  provider: string | null;
};

function isComplete(t: TeamRow) {
  return !!(t.name && t.code && t.coach?.trim() && t.confederation?.trim() && t.flag_url?.trim());
}

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (.env.cloud)');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: teams, error } = await supabase
    .from('teams')
    .select('id,name,code,country_code,coach,confederation,fifa_ranking,flag_url,provider');

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = (teams ?? []) as TeamRow[];
  const total = rows.length;
  const complete = rows.filter(isComplete);
  const incomplete = rows.filter(t => !isComplete(t));

  const report = {
    generatedAt: new Date().toISOString(),
    source: url.replace(/\/\/.*@/, '//***@'),
    summary: {
      total,
      complete: complete.length,
      completePct: total > 0 ? Math.round((complete.length / total) * 1000) / 10 : 0,
      incomplete: incomplete.length,
      withCoach: rows.filter(t => !!t.coach?.trim()).length,
      withConfederation: rows.filter(t => !!t.confederation?.trim()).length,
      withFlag: rows.filter(t => !!t.flag_url?.trim()).length,
      withRanking: rows.filter(t => t.fifa_ranking != null).length,
      withProvider: rows.filter(t => !!t.provider?.trim()).length,
    },
    completeTeams: complete.map(t => ({ id: t.id, name: t.name, code: t.code })),
    incompleteTeams: incomplete.map(t => ({
      id: t.id,
      name: t.name,
      missing: [
        !t.code && 'code',
        !t.coach?.trim() && 'coach',
        !t.confederation?.trim() && 'confederation',
        !t.flag_url?.trim() && 'flag_url',
      ].filter(Boolean),
    })),
  };

  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/team-coverage.json', JSON.stringify(report, null, 2));
  console.log(`Team coverage → reports/team-coverage.json (${complete.length}/${total} completos)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
