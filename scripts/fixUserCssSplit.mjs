import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const adminPath = join(root, 'src/styles/admin.css')
const profilePath = join(root, 'src/styles/profile.css')
const fixturePath = join(root, 'src/styles/fixture.css')

const lines = readFileSync(adminPath, 'utf8').split(/\r?\n/)

const adminHeadEnd = lines.findIndex((l, i) => i > 0 && l.includes('Profile Premium'))
const fixtureStart = lines.findIndex(l => l.includes('Fixture Game Center'))
const adminV2Start = lines.findIndex(l => l.includes('Admin V2'))

if (adminHeadEnd < 0 || fixtureStart < 0 || adminV2Start < 0) {
  console.error('split markers not found', { adminHeadEnd, fixtureStart, adminV2Start })
  process.exit(1)
}

const adminSupportStart = lines.findIndex((l, i) => i > fixtureStart && l.startsWith('.admin-support-status'))
const profileLines = lines.slice(adminHeadEnd, adminSupportStart >= 0 ? adminSupportStart : fixtureStart)
const adminSupportLines =
  adminSupportStart >= 0 && adminSupportStart < fixtureStart ? lines.slice(adminSupportStart, fixtureStart) : []
const fixtureLines = lines.slice(fixtureStart, adminV2Start)
const adminLines = [...lines.slice(0, adminHeadEnd), ...adminSupportLines, ...lines.slice(adminV2Start)]

writeFileSync(profilePath, profileLines.join('\n').trimEnd() + '\n')
writeFileSync(fixturePath, fixtureLines.join('\n').trimEnd() + '\n')
writeFileSync(adminPath, adminLines.join('\n').trimEnd() + '\n')

console.log('profile.css', profileLines.length, 'lines')
console.log('fixture.css', fixtureLines.length, 'lines')
console.log('admin.css', adminLines.length, 'lines')
