import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createNodeSupabaseClient } from '../lib/supabaseNodeClient.js'
import { initLoadEnv } from '../load/lib/loadEnv.js'
import { evaluateBeta300, BETA300_ACTION_LABELS } from '../../src/utils/beta300Capacity.ts'
import { MAX_BETA_USERS } from '../../src/config/betaMode.ts'

async function main() {
  console.log('\n=== BETA 300 REPORT ===\n')
  const { url, serviceKey } = initLoadEnv()
  const sb = createNodeSupabaseClient(url, serviceKey)

  const dayAgo = new Date(Date.now() - 86400000).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const [profilesRes, predsRes, activity24hRes, activity7dRes, syncErrRes, deviceRes] = await Promise.all([
    sb.from('profiles').select('id, created_at, deleted_at'),
    sb.from('predictions').select('id, created_at'),
    sb.from('activity_logs').select('user_id').gte('created_at', dayAgo),
    sb.from('activity_logs').select('user_id').gte('created_at', weekAgo),
    sb.from('data_sync_logs').select('id', { count: 'exact', head: true }).in('status', ['failed', 'error']).gte('started_at', dayAgo),
    sb.from('device_reports').select('event_type, device_type, browser, route, error_message, performance_ms, created_at').gte('created_at', dayAgo),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (predsRes.error) throw predsRes.error

  const profiles = (profilesRes.data ?? []).filter(p => !p.deleted_at)
  const preds = predsRes.data ?? []
  const devices = deviceRes.error?.message.includes('does not exist') ? [] : (deviceRes.data ?? [])
  if (deviceRes.error && !deviceRes.error.message.includes('does not exist')) {
    console.warn('device_reports:', deviceRes.error.message)
  }

  const registered = profiles.length
  const newToday = profiles.filter(p => new Date(p.created_at) >= new Date(new Date().setHours(0, 0, 0, 0))).length
  const active24h = new Set((activity24hRes.data ?? []).map(r => r.user_id).filter(Boolean)).size
  const active7d = new Set((activity7dRes.data ?? []).map(r => r.user_id).filter(Boolean)).size
  const preds24h = preds.filter(p => new Date(p.created_at) >= new Date(dayAgo)).length

  const reports24h = devices.length
  const errors24h = devices.filter(d => d.event_type === 'error').length
  const errorRate = reports24h > 0 ? Math.round((errors24h / reports24h) * 1000) / 10 : 0

  const errorsByDevice: Record<string, number> = {}
  const errorsByBrowser: Record<string, number> = {}
  const errorsByRoute: Record<string, number> = {}
  let mobileErrors = 0

  for (const d of devices.filter(x => x.event_type === 'error')) {
    errorsByDevice[d.device_type] = (errorsByDevice[d.device_type] ?? 0) + 1
    const br = d.browser ?? 'unknown'
    errorsByBrowser[br] = (errorsByBrowser[br] ?? 0) + 1
    errorsByRoute[d.route] = (errorsByRoute[d.route] ?? 0) + 1
    if (d.device_type === 'mobile') mobileErrors++
  }

  const mobileShare = errors24h > 0 ? Math.round((mobileErrors / errors24h) * 1000) / 10 : 0
  const auth429 = devices.filter(
    d => d.event_type === 'error' && (d.error_message?.includes('429') || d.error_message?.toLowerCase().includes('rate limit')),
  ).length

  const evaluation = evaluateBeta300({
    registeredUsers: registered,
    activeUsers24h: active24h,
    activeUsers7d: active7d,
    syncErrors24h: syncErrRes.count ?? 0,
    authErrors429: auth429,
    deviceHealth: {
      reports_24h: reports24h,
      errors_24h: errors24h,
      error_rate: errorRate,
      errors_by_device: errorsByDevice,
      errors_by_browser: errorsByBrowser,
      slow_routes: [],
      top_error_routes: Object.entries(errorsByRoute)
        .map(([route, count]) => ({ route, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      mobile_error_share_pct: mobileShare,
    },
  })

  const inviteAdvice =
    evaluation.status === 'exceeded' || evaluation.status === 'red'
      ? 'FRENAR invitaciones'
      : evaluation.status === 'yellow'
        ? 'Abrir con cautela — monitorear diario'
        : 'Puede abrir invitaciones controladas'

  const report = {
    generated_at: new Date().toISOString(),
    estado_general: evaluation.status,
    usuarios: `${registered}/${MAX_BETA_USERS}`,
    capacidad_pct: evaluation.capacityPercent,
    nuevos_hoy: newToday,
    activos_24h: active24h,
    predicciones_24h: preds24h,
    dispositivos: {
      reportes_24h: reports24h,
      errores_24h: errors24h,
      tasa_error_pct: errorRate,
      por_dispositivo: errorsByDevice,
      por_navegador: errorsByBrowser,
      mobile_error_pct: mobileShare,
    },
    errores: {
      sync_24h: syncErrRes.count ?? 0,
      auth_429_24h: auth429,
    },
    recomendacion: evaluation.message,
    accion_tecnica: BETA300_ACTION_LABELS[evaluation.technicalAction],
    invitaciones: inviteAdvice,
    migration_needed: evaluation.migrationNeeded,
    reasons: evaluation.reasons,
  }

  const dir = join(process.cwd(), 'reports')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'beta-300-report.json'), JSON.stringify(report, null, 2))

  console.log(`Estado: ${evaluation.status.toUpperCase()} — ${registered}/${MAX_BETA_USERS} (${evaluation.capacityPercent}%)`)
  console.log(`Nuevos hoy: ${newToday} | Activos 24h: ${active24h} | Predicciones 24h: ${preds24h}`)
  console.log(`Dispositivos: ${reports24h} reportes, ${errors24h} errores (${errorRate}%)`)
  console.log(`Mobile errores: ${mobileShare}%`)
  console.log(`Recomendación: ${evaluation.message}`)
  console.log(`Invitaciones: ${inviteAdvice}`)
  console.log(`Acción: ${BETA300_ACTION_LABELS[evaluation.technicalAction]}`)
  console.log(`\nReporte: reports/beta-300-report.json\n`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
