import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const indexPath = join(root, 'src/index.css')
const adminPath = join(root, 'src/styles/admin.css')

mkdirSync(dirname(adminPath), { recursive: true })

const lines = readFileSync(indexPath, 'utf8').split(/\r?\n/)
const adminLines = lines.slice(8205, 12380)
const kept = [...lines.slice(0, 8205), ...lines.slice(12380)]

writeFileSync(adminPath, adminLines.join('\n'))
writeFileSync(indexPath, kept.join('\n'))

console.log(`extracted ${adminLines.length} admin lines -> src/styles/admin.css`)
console.log(`index.css now ${kept.length} lines`)
