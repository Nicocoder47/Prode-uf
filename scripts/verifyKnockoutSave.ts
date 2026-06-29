import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnv(file: string) {
  const p = resolve(process.cwd(), file)
  try {
    const txt = readFileSync(p, 'utf8')
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (!m) continue
      const k = m[1].trim()
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (!process.env[k]) process.env[k] = v
    }
  } catch {
    // optional env file
  }
}

for (const f of ['.env.cloud', '.env.local', '.env']) loadEnv(f)

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltan VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
}

async function main() {
  let ok = true

  const colRes = await fetch(
    `${url}/rest/v1/predictions?select=predicted_et_score_home,predicted_et_score_away,predicted_penalty_winner&limit=1`,
    { headers },
  )
  const colBody = await colRes.text()
  if (!colRes.ok) {
    ok = false
    console.log('FAIL columnas ET/penales:', colRes.status, colBody.slice(0, 200))
  } else {
    console.log('OK columnas ET/penales en predictions')
  }

  const matchRes = await fetch(
    `${url}/rest/v1/matches?select=id,phase,status,is_locked,kick_off&phase=eq.round32&status=eq.scheduled&limit=5`,
    { headers },
  )
  const matchBody = await matchRes.text()
  let sampleId = '00000000-0000-0000-0000-000000000001'
  if (!matchRes.ok) {
    ok = false
    console.log('FAIL consulta round32:', matchRes.status, matchBody.slice(0, 200))
  } else {
    const matches = JSON.parse(matchBody) as { id: string }[]
    console.log(`OK partidos round32 programados: ${matches.length}`)
    if (matches[0]) {
      sampleId = matches[0].id
      console.log('  ejemplo:', sampleId)
    }
  }

  const rpc6 = await fetch(`${url}/rest/v1/rpc/save_prediction`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_match_id: sampleId,
      p_score_home: 1,
      p_score_away: 0,
      p_et_score_home: null,
      p_et_score_away: null,
      p_penalty_winner: null,
    }),
  })
  const rpc6Body = await rpc6.text()
  const rpc6Missing = rpc6Body.toLowerCase().includes('could not find the function')
  if (rpc6.status === 404 || rpc6Missing) {
    ok = false
    console.log('FAIL RPC save_prediction (6 params):', rpc6.status, rpc6Body.slice(0, 200))
  } else {
    console.log('OK RPC save_prediction (6 params) —', rpc6.status, rpc6Body.slice(0, 120))
  }

  const rpc3 = await fetch(`${url}/rest/v1/rpc/save_prediction`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_match_id: sampleId,
      p_score_home: 1,
      p_score_away: 0,
    }),
  })
  const rpc3Body = await rpc3.text()
  const rpc3Missing = rpc3Body.toLowerCase().includes('could not find the function')
  if (rpc3Missing) {
    ok = false
    console.log('FAIL RPC legacy (3 params) tampoco disponible')
  } else {
    console.log('OK RPC legacy (3 params) —', rpc3.status, rpc3Body.slice(0, 120))
  }

  const rpcDraw = await fetch(`${url}/rest/v1/rpc/save_prediction`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_match_id: sampleId,
      p_score_home: 1,
      p_score_away: 1,
      p_et_score_home: 1,
      p_et_score_away: 0,
      p_penalty_winner: null,
    }),
  })
  const rpcDrawBody = await rpcDraw.text()
  if (rpcDrawBody.includes('knockout_et_required') || rpcDrawBody.includes('knockout_penalty_winner_required')) {
    console.log('OK validación knockout en RPC (empate requiere alargue/penales)')
  } else if (rpcDrawBody.toLowerCase().includes('could not find the function')) {
    ok = false
    console.log('FAIL validación knockout: RPC extendido ausente')
  } else {
    console.log('INFO respuesta empate 1-1:', rpcDraw.status, rpcDrawBody.slice(0, 160))
  }

  process.exit(ok ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
