import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const assetsDir = join(root, 'dist/assets')
const previewBase = process.env.PREVIEW_URL ?? 'http://127.0.0.1:4173'

const files = readdirSync(assetsDir)
const profileCss = files.find(f => f.startsWith('ProfilePage-') && f.endsWith('.css'))
const matchesCss = files.find(f => f.startsWith('MatchesPage-') && f.endsWith('.css'))
const profileJs = files.find(f => f.startsWith('ProfilePage-') && f.endsWith('.js'))
const matchesJs = files.find(f => f.startsWith('MatchesPage-') && f.endsWith('.js'))
const adminCss = files.find(f => f.startsWith('AdminShell-') && f.endsWith('.css'))

const checks = []

function ok(name, pass, detail) {
  checks.push({ name, pass, detail })
}

if (!profileCss || !matchesCss || !profileJs || !matchesJs) {
  console.error('missing chunks', { profileCss, matchesCss, profileJs, matchesJs })
  process.exit(1)
}

const profileCssText = readFileSync(join(assetsDir, profileCss), 'utf8')
const matchesCssText = readFileSync(join(assetsDir, matchesCss), 'utf8')
const adminCssText = adminCss ? readFileSync(join(assetsDir, adminCss), 'utf8') : ''
const profileJsText = readFileSync(join(assetsDir, profileJs), 'utf8')
const matchesJsText = readFileSync(join(assetsDir, matchesJs), 'utf8')

ok('profile-css-has-hero', profileCssText.includes('.wc26-profile-premium-hero'), profileCss)
ok('matches-css-has-fixture', matchesCssText.includes('.wc26-fixture-page'), matchesCss)
ok('admin-css-no-profile-hero', !adminCssText.includes('.wc26-profile-premium-hero'), adminCss ?? 'n/a')
ok('admin-css-no-fixture-page', !adminCssText.includes('.wc26-fixture-page'), adminCss ?? 'n/a')
ok('profile-js-imports-css', profileJsText.includes(profileCss), profileJs)
ok('matches-js-imports-css', matchesJsText.includes(matchesCss), matchesJs)

for (const file of [profileCss, matchesCss]) {
  const res = await fetch(`${previewBase}/assets/${file}`)
  ok(`preview-200-${file}`, res.status === 200, String(res.status))
}

const failed = checks.filter(c => !c.pass)
console.log(JSON.stringify({ previewBase, checks, pass: failed.length === 0 }, null, 2))
process.exit(failed.length === 0 ? 0 : 1)
