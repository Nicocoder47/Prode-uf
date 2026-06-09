/**
 * Importa padrón de referencia desde Excel a member_reference.
 *
 * Uso:
 *   npm run import:member-reference
 *   npm run import:member-reference -- "C:\ruta\datos usuarios.xlsx"
 *
 * Columnas esperadas: Apellido, Nombre, D.N.I. (variantes aceptadas)
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import * as XLSX from 'xlsx'
import { supabase } from '../src/database/supabaseClient.ts'

const DEFAULT_PATHS = [
  process.env.MEMBER_REFERENCE_XLSX,
  'data/datos-usuarios.xlsx',
  'data/datos usuarios.xlsx',
  resolve(process.env.USERPROFILE ?? '', 'Downloads', 'datos usuarios.xlsx'),
  'C:\\Users\\Nicoy\\Downloads\\datos usuarios.xlsx',
].filter(Boolean) as string[]

function normalizeDni(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '')
}

function normalizeName(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function pickColumn(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key]
    }
  }
  const normalized = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]),
  )
  for (const key of keys) {
    const val = normalized[key.toLowerCase()]
    if (val !== undefined && val !== null && String(val).trim() !== '') return val
  }
  return undefined
}

function resolveExcelPath(): string {
  const cliPath = process.argv[2]
  if (cliPath && existsSync(cliPath)) return resolve(cliPath)

  for (const candidate of DEFAULT_PATHS) {
    if (existsSync(candidate)) return resolve(candidate)
  }

  throw new Error(
    `No se encontró el Excel. Pasá la ruta como argumento o copiá el archivo a data/datos-usuarios.xlsx\nBuscado en:\n${DEFAULT_PATHS.join('\n')}`,
  )
}

async function main() {
  const filePath = resolveExcelPath()
  console.log(`Leyendo: ${filePath}\n`)

  const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  let read = 0
  let inserted = 0
  let updated = 0
  let rejected = 0
  let duplicates = 0
  let errors = 0

  const seenDni = new Set<string>()

  for (const row of rows) {
    read++
    const lastName = normalizeName(pickColumn(row, ['Apellido', 'APELLIDO', 'apellido']))
    const firstName = normalizeName(pickColumn(row, ['Nombre', 'NOMBRE', 'nombre']))
    const dni = normalizeDni(pickColumn(row, ['D.N.I.', 'DNI', 'D.N.I', 'dni', 'Dni']))

    if (!dni || dni.length < 7 || dni.length > 8) {
      rejected++
      continue
    }

    if (seenDni.has(dni)) {
      duplicates++
      continue
    }
    seenDni.add(dni)

    const fullName = `${lastName}, ${firstName}`.replace(/^,\s*|,\s*$/g, '').trim()

    const { data: existing, error: findErr } = await supabase
      .from('member_reference')
      .select('id')
      .eq('dni', dni)
      .maybeSingle()

    if (findErr) {
      if (findErr.message.includes('member_reference') || findErr.code === 'PGRST205') {
        console.error('\n❌ Tabla member_reference no existe. Ejecutá primero: npm run db:push:cloud')
        process.exit(1)
      }
      errors++
      console.error(`Error fila ${read}:`, findErr.message)
      continue
    }

    const payload = {
      dni,
      last_name: lastName || null,
      first_name: firstName || null,
      full_name: fullName || null,
      source: 'excel_import',
      updated_at: new Date().toISOString(),
    }

    if (existing?.id) {
      const { error } = await supabase.from('member_reference').update(payload).eq('id', existing.id)
      if (error) {
        errors++
        console.error(`Error actualizando DNI ${dni}:`, error.message)
      } else {
        updated++
      }
    } else {
      const { error } = await supabase.from('member_reference').insert(payload)
      if (error) {
        errors++
        console.error(`Error insertando DNI ${dni}:`, error.message)
      } else {
        inserted++
      }
    }
  }

  console.log('=== IMPORTACIÓN PADRÓN DNI ===')
  console.log(`Total leídos:    ${read}`)
  console.log(`Insertados:      ${inserted}`)
  console.log(`Actualizados:    ${updated}`)
  console.log(`Rechazados:      ${rejected} (DNI inválido o vacío)`)
  console.log(`Duplicados:      ${duplicates} (mismo DNI repetido en Excel)`)
  console.log(`Errores:         ${errors}`)

  if (inserted + updated > 0) {
    console.log('\nRe-aplicando revisión de perfiles existentes…')
    const { data: profiles } = await supabase.from('profiles').select('id').not('dni', 'is', null)
    let reviewed = 0
    for (const p of profiles ?? []) {
      const { error } = await supabase.rpc('apply_profile_dni_review', { p_user_id: p.id })
      if (!error) reviewed++
    }
    console.log(`Perfiles re-evaluados: ${reviewed}`)
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
