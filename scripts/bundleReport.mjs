import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const distAssets = join(process.cwd(), 'dist/assets')
const files = readdirSync(distAssets)
  .filter(f => f.endsWith('.js') || f.endsWith('.css'))
  .map(name => {
    const size = statSync(join(distAssets, name)).size
    return { name, kb: Math.round((size / 1024) * 10) / 10 }
  })
  .sort((a, b) => b.kb - a.kb)

const cssKb = files.filter(f => f.name.endsWith('.css')).reduce((s, f) => s + f.kb, 0)
const jsKb = files.filter(f => f.name.endsWith('.js')).reduce((s, f) => s + f.kb, 0)
const indexEntry = files.find(f => f.name.startsWith('index-') && f.name.endsWith('.js'))
const initialVendor = ['react-vendor', 'supabase', 'react-query', 'react-router', 'framer-motion']
  .map(prefix => files.find(f => f.name.startsWith(prefix)))
  .filter(Boolean)
const initialBundleKb = Math.round(
  (indexEntry?.kb ?? 0) + initialVendor.reduce((s, f) => s + f.kb, 0),
)

const payload = {
  totalBundleKb: Math.round((jsKb + cssKb) * 10) / 10,
  jsKb: Math.round(jsKb * 10) / 10,
  cssKb: Math.round(cssKb * 10) / 10,
  initialBundleKb,
  indexEntryKb: indexEntry?.kb ?? 0,
  largestChunks: files.slice(0, 12),
}

console.log(JSON.stringify(payload, null, 2))
