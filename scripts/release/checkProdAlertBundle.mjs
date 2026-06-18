const base = 'https://prodemundialprode.vercel.app'
const html = await fetch(base + '/').then(r => r.text())
const jsMatch = html.match(/assets\/index-([^"]+)/)
if (!jsMatch) {
  console.log('No index JS in HTML')
  process.exit(1)
}
const jsUrl = `${base}/assets/index-${jsMatch[1]}`
const js = await fetch(jsUrl).then(r => r.text())
console.log('JS bundle:', jsMatch[1])
console.log('RPC get_active_global_alert:', js.includes('get_active_global_alert'))
console.log('Class wc26-global-alert in JS:', js.includes('wc26-global-alert'))

const cssMatch = html.match(/assets\/index-([^"]+\.css)/)
if (cssMatch) {
  const css = await fetch(`${base}/assets/index-${cssMatch[1]}`).then(r => r.text())
  console.log('CSS wc26-global-alert:', css.includes('wc26-global-alert'))
}
