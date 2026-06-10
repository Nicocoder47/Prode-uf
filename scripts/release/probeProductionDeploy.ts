const urls = ['https://prode-sepia.vercel.app/', 'https://prodemundialprode.vercel.app/']

for (const u of urls) {
  const r = await fetch(u)
  const html = await r.text()
  const js = html.match(/index-[^.]+\.js/)?.[0]
  const main = js ? await (await fetch(`${u}assets/${js}`)).text() : ''
  console.log('URL', u)
  console.log('  bundle', js)
  console.log('  CSP', r.headers.get('content-security-policy')?.slice(0, 50) ?? 'NONE')
  console.log('  X-Frame', r.headers.get('x-frame-options') ?? 'NONE')
  console.log('  admin_get_beta_capacity', main.includes('admin_get_beta_capacity'))
  console.log('  fail_closed_msg', main.includes('RPC admin no disponible'))
  console.log('  change_password', main.includes('change-password') || main.includes('ChangePassword'))
  console.log('  registration_status', main.includes('admin_get_registration_status'))
}
