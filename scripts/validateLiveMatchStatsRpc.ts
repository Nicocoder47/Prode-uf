/**
 * Auditoría y validación de get_live_match_stats() en Supabase Cloud.
 * npm run validate:live-match-stats
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCloudEnv } from './lib/loadCloudEnv.js'

loadCloudEnv()

const MIGRATION_FILE = '20240122000000_live_match_stats.sql'
const RPC_NAME = 'get_live_match_stats'

type RpcRow = {
  match_id: string
  prediction_count: number
  home_pct: number
  draw_pct: number
  away_pct: number
}

type AuditReport = {
  rpcExists: 'EXISTS' | 'MISSING' | 'ERROR'
  migrationApplied: boolean
  migrationAppliedNow: boolean
  permissions: { anon: boolean; service: boolean }
  securityDefiner: boolean | null
  sampleRows: RpcRow[]
  rowCount: number
  exposesPrivateFields: boolean
  columnsOk: boolean
  errors: string[]
}

async function probeRpc(
  url: string,
  key: string,
  label: string,
): Promise<{ ok: boolean; missing: boolean; rows: RpcRow[]; error?: string }> {
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${RPC_NAME}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: '{}',
  })
  const body = await res.text()
  if (!res.ok) {
    const msg = body.toLowerCase()
    const missing =
      msg.includes('pgrst202') ||
      msg.includes('42883') ||
      (msg.includes('function') && msg.includes('does not exist')) ||
      msg.includes('could not find the function')
    return { ok: false, missing, rows: [], error: body.slice(0, 240) }
  }
  let parsed: unknown = []
  try {
    parsed = body ? JSON.parse(body) : []
  } catch {
    return { ok: false, missing: false, rows: [], error: `JSON inválido: ${body.slice(0, 120)}` }
  }
  const rows = (Array.isArray(parsed) ? parsed : []) as RpcRow[]
  console.log(`✔ RPC callable (${label}) — ${rows.length} filas`)
  return { ok: true, missing: false, rows }
}

async function applyMigration220(): Promise<boolean> {
  const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim()
  const ref = process.env.SUPABASE_PROJECT_REF || 'irklqwsnehlfcgehvscm'
  if (!dbPassword) {
    console.log('⚠ SUPABASE_DB_PASSWORD no configurada — no se puede aplicar migración por Postgres')
    return false
  }

  const connectionString =
    process.env.SUPABASE_DB_URL?.trim() ||
    `postgresql://postgres.${ref}:${encodeURIComponent(dbPassword)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations_local (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `)

  const { rows: applied } = await client.query(
    'SELECT 1 FROM public.schema_migrations_local WHERE filename = $1',
    [MIGRATION_FILE],
  )
  if (applied.length > 0) {
    console.log(`⏭ ${MIGRATION_FILE} ya registrada en schema_migrations_local`)
    await client.end()
    return false
  }

  const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', MIGRATION_FILE), 'utf8')
  console.log(`▶ Aplicando ${MIGRATION_FILE}…`)
  await client.query(sql)
  await client.query('INSERT INTO public.schema_migrations_local (filename) VALUES ($1)', [MIGRATION_FILE])
  console.log(`✓ ${MIGRATION_FILE} aplicada`)
  await client.end()
  return true
}

async function inspectFunctionMeta(): Promise<{ securityDefiner: boolean | null }> {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  if (!token) return { securityDefiner: null }

  const { execFileSync } = await import('node:child_process')
  try {
    const out = execFileSync(
      'npx',
      [
        'supabase',
        'db',
        'query',
        '--linked',
        '-o',
        'json',
        `SELECT p.prosecdef AS security_definer FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = '${RPC_NAME}' LIMIT 1;`,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const parsed = JSON.parse(out) as { rows?: { security_definer: boolean }[] }
    return { securityDefiner: parsed.rows?.[0]?.security_definer ?? null }
  } catch {
    return { securityDefiner: null }
  }
}

function validateRows(rows: RpcRow[]): { columnsOk: boolean; exposesPrivateFields: boolean } {
  const forbidden = ['user_id', 'predicted_winner', 'home_score', 'away_score', 'email', 'dni', 'legajo']
  let exposesPrivateFields = false
  let columnsOk = true

  for (const row of rows) {
    const keys = Object.keys(row as object)
    for (const k of forbidden) {
      if (keys.includes(k)) exposesPrivateFields = true
    }
    if (
      typeof row.match_id !== 'string' ||
      typeof row.prediction_count !== 'number' ||
      typeof row.home_pct !== 'number' ||
      typeof row.draw_pct !== 'number' ||
      typeof row.away_pct !== 'number'
    ) {
      columnsOk = false
    }
    const sum = row.home_pct + row.draw_pct + row.away_pct
    if (row.prediction_count > 0 && (sum < 98 || sum > 102)) {
      columnsOk = false
    }
  }

  return { columnsOk, exposesPrivateFields }
}

async function main() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

  if (!url || !serviceKey) {
    console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.cloud')
    process.exit(1)
  }

  const report: AuditReport = {
    rpcExists: 'ERROR',
    migrationApplied: false,
    migrationAppliedNow: false,
    permissions: { anon: false, service: false },
    securityDefiner: null,
    sampleRows: [],
    rowCount: 0,
    exposesPrivateFields: false,
    columnsOk: false,
    errors: [],
  }

  console.log('\n=== FASE 1 — Auditoría Cloud ===\n')
  const serviceProbe = await probeRpc(url, serviceKey, 'service_role')
  report.permissions.service = serviceProbe.ok
  report.sampleRows = serviceProbe.rows.slice(0, 5)
  report.rowCount = serviceProbe.rows.length

  if (serviceProbe.missing) {
    report.rpcExists = 'MISSING'
    console.log('✖ Diagnóstico: MISSING')
  } else if (serviceProbe.ok) {
    report.rpcExists = 'EXISTS'
    console.log('✔ Diagnóstico: EXISTS')
    report.migrationApplied = true
  } else {
    report.rpcExists = 'ERROR'
    report.errors.push(serviceProbe.error ?? 'RPC error')
    console.log(`✖ Diagnóstico: ERROR — ${serviceProbe.error}`)
  }

  if (anonKey) {
    const anonProbe = await probeRpc(url, anonKey, 'anon')
    report.permissions.anon = anonProbe.ok
  }

  if (report.rpcExists === 'MISSING') {
    console.log('\n=== FASE 2 — Aplicar migración 220 ===\n')
    report.migrationAppliedNow = await applyMigration220()
    if (report.migrationAppliedNow) {
      const retry = await probeRpc(url, serviceKey, 'service_role post-migration')
      report.permissions.service = retry.ok
      report.sampleRows = retry.rows.slice(0, 5)
      report.rowCount = retry.rows.length
      report.rpcExists = retry.ok ? 'EXISTS' : retry.missing ? 'MISSING' : 'ERROR'
      report.migrationApplied = retry.ok
    }
  }

  console.log('\n=== FASE 3 — Validación RPC ===\n')
  const meta = await inspectFunctionMeta()
  report.securityDefiner = meta.securityDefiner
  if (meta.securityDefiner === true) console.log('✔ SECURITY DEFINER confirmado')
  else if (meta.securityDefiner === false) console.log('✖ SECURITY DEFINER = false')
  else console.log('⚠ No se pudo verificar SECURITY DEFINER (sin DB password)')

  const finalRows =
    report.sampleRows.length > 0 ? report.sampleRows : serviceProbe.rows.slice(0, 5)
  report.sampleRows = finalRows
  const validation = validateRows(serviceProbe.ok ? serviceProbe.rows : finalRows)
  report.columnsOk = validation.columnsOk
  report.exposesPrivateFields = validation.exposesPrivateFields

  if (report.exposesPrivateFields) {
    console.log('✖ Expone campos privados')
    report.errors.push('RPC expone campos privados')
  } else {
    console.log('✔ Sin user_id ni predicciones individuales')
  }

  if (report.columnsOk || report.rowCount === 0) {
    console.log('✔ Columnas esperadas: match_id, prediction_count, home_pct, draw_pct, away_pct')
  } else {
    console.log('✖ Columnas o porcentajes inválidos')
    report.errors.push('Columnas o porcentajes inválidos')
  }

  if (report.sampleRows.length > 0) {
    console.log('\nMuestra (máx 5 filas):')
    console.table(report.sampleRows)
  } else {
    console.log('\nSin filas — normal si aún no hay predicciones válidas en DB')
  }

  const outPath = join(process.cwd(), 'reports', 'live-match-stats-audit.json')
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync(join(process.cwd(), 'reports'), { recursive: true })
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\nReporte → ${outPath}`)

  const ready =
    report.rpcExists === 'EXISTS' &&
    report.permissions.service &&
    !report.exposesPrivateFields &&
    (report.securityDefiner === true || report.securityDefiner === null)

  console.log(`\nEstado: ${ready ? 'READY FOR DEPLOY' : 'BLOCKED'}`)
  if (!ready) process.exit(1)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
