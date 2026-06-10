import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createNodeSupabaseClient } from '../lib/supabaseNodeClient.js'
import { initLoadEnv } from '../load/lib/loadEnv.js'
import { MAX_BETA_USERS } from '../../src/config/betaMode.ts'

async function main() {
  console.log('\n=== BETA 300 SECURITY REPORT ===\n')
  const { url, serviceKey } = initLoadEnv()
  const sb = createNodeSupabaseClient(url, serviceKey)

  const [profilesRes, settingsRes, activityRes, deviceRes] = await Promise.all([
    sb.from('profiles').select('id, role, is_active, deleted_at, must_change_password, is_blocked, created_at'),
    sb.from('admin_settings').select('value').eq('key', 'registration_open').maybeSingle(),
    sb.from('activity_logs').select('type, created_at, metadata').eq('type', 'admin_role_changed').order('created_at', { ascending: false }).limit(10),
    sb.from('device_reports').select('event_type, device_type, error_message, created_at').gte('created_at', new Date(Date.now() - 86400000).toISOString()),
  ])

  const profiles = profilesRes.data ?? []
  const active = profiles.filter(p => !p.deleted_at)
  const registered = active.length
  const admins = active.filter(p => p.role === 'admin' && p.is_active).length
  const mustChange = active.filter(p => p.must_change_password).length
  const blocked = active.filter(p => p.is_blocked).length
  const deactivated = profiles.filter(p => p.deleted_at).length
  const regOpen = settingsRes.data?.value
    ? (settingsRes.data.value as { enabled?: boolean }).enabled !== false
    : true

  const devices = deviceRes.data ?? []
  const errors = devices.filter(d => d.event_type === 'error')
  const mobileErrors = errors.filter(d => d.device_type === 'mobile').length
  const mobileShare = errors.length > 0 ? Math.round((mobileErrors / errors.length) * 100) : 0

  const critical: string[] = []
  if (registered > MAX_BETA_USERS) critical.push('Usuarios exceden beta 300')
  if (admins < 1) critical.push('Sin admins activos')
  if (!regOpen && registered < MAX_BETA_USERS) critical.push('Invitaciones cerradas (manual)')
  if (mustChange > registered * 0.5) critical.push('Muchos usuarios deben cambiar contraseña')

  const report = {
    generated_at: new Date().toISOString(),
    estado_beta: registered > MAX_BETA_USERS ? 'exceeded' : registered >= 280 ? 'red' : registered >= 220 ? 'yellow' : 'green',
    usuarios: `${registered}/${MAX_BETA_USERS}`,
    invitaciones_abiertas: regOpen,
    usuarios_deben_cambiar_password: mustChange,
    usuarios_bloqueados: blocked,
    usuarios_desactivados: deactivated,
    admins_activos: admins,
    ultimos_cambios_rol: activityRes.data ?? [],
    dispositivos_errores_24h: errors.length,
    mobile_error_pct: mobileShare,
    problemas_criticos: critical,
    recomendacion: critical.length
      ? 'Revisar alertas antes de abrir más invitaciones'
      : regOpen
        ? 'Operación beta estable — monitorear diario'
        : 'Invitaciones cerradas — OK para contener crecimiento',
  }

  const dir = join(process.cwd(), 'reports')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'beta-300-security-report.json'), JSON.stringify(report, null, 2))

  console.log(`Usuarios: ${report.usuarios} | Invitaciones: ${regOpen ? 'ABIERTAS' : 'CERRADAS'}`)
  console.log(`Deben cambiar password: ${mustChange} | Bloqueados: ${blocked} | Admins: ${admins}`)
  console.log(`Errores dispositivo 24h: ${errors.length} | Mobile: ${mobileShare}%`)
  console.log(`Recomendación: ${report.recomendacion}`)
  if (critical.length) console.log('Críticos:', critical.join('; '))
  console.log('\nReporte: reports/beta-300-security-report.json\n')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
