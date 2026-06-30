/**
 * Rebuild leaderboard.points desde SUM(predictions.points) WHERE status='scored'
 * npm run release:rebuild-leaderboard
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadCloudEnv } from '../lib/loadCloudEnv.js'

loadCloudEnv()

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm'

if (!accessToken) {
  console.error('Falta SUPABASE_ACCESS_TOKEN en .env.cloud')
  process.exit(1)
}

async function mgmtQuery(query: string) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 400)}`)
  try {
    return JSON.parse(body) as unknown
  } catch {
    return body
  }
}

const REBUILD_SQL = `
WITH agg AS (
  SELECT p.user_id, coalesce(sum(p.points), 0)::int AS total_points
  FROM public.predictions p
  WHERE p.status = 'scored'
  GROUP BY p.user_id
),
upserted AS (
  INSERT INTO public.leaderboard (user_id, period, rank, points, wins, draws, losses, updated_at)
  SELECT
    a.user_id,
    'global',
    1,
    a.total_points,
    coalesce(lb.wins, 0),
    coalesce(lb.draws, 0),
    coalesce(lb.losses, 0),
    now()
  FROM agg a
  LEFT JOIN public.leaderboard lb ON lb.user_id = a.user_id AND lb.period = 'global'
  ON CONFLICT (user_id, period) DO UPDATE SET
    points = EXCLUDED.points,
    updated_at = now()
  RETURNING user_id
)
SELECT count(*)::int AS users_rebuilt FROM upserted;
`

const CLEANUP_SQL = `
DELETE FROM public.leaderboard lb
WHERE lb.period = 'global'
  AND NOT EXISTS (
    SELECT 1 FROM public.predictions p
    WHERE p.user_id = lb.user_id AND p.status = 'scored'
  );
`

const RANKS_SQL = `
WITH ranked AS (
  SELECT user_id, ROW_NUMBER() OVER (ORDER BY points DESC, updated_at ASC) AS new_rank
  FROM public.leaderboard
  WHERE period = 'global'
)
UPDATE public.leaderboard lb
SET rank = r.new_rank
FROM ranked r
WHERE lb.user_id = r.user_id AND lb.period = 'global';
`

async function main() {
  console.log('▶ Rebuild leaderboard desde predictions...')
  const rebuilt = (await mgmtQuery(REBUILD_SQL)) as { users_rebuilt?: number }[]
  const usersRebuilt = rebuilt[0]?.users_rebuilt ?? '?'
  console.log(`✓ Usuarios actualizados: ${usersRebuilt}`)

  await mgmtQuery(CLEANUP_SQL)
  console.log('✓ Filas huérfanas eliminadas')

  await mgmtQuery(RANKS_SQL)
  console.log('✓ Ranks recalculados')

  const report = {
    generated_at: new Date().toISOString(),
    users_rebuilt: usersRebuilt,
    ok: true,
  }
  const outDir = join(process.cwd(), 'reports')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'leaderboard-rebuild.json'), JSON.stringify(report, null, 2))
  console.log('Reporte: reports/leaderboard-rebuild.json')
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
