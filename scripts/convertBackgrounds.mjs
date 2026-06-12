import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')

const targets = [
  { input: 'fondo-jugar.png', mobile: 'fondo-jugar-mobile.webp', desktop: 'fondo-jugar.webp' },
  { input: 'fondo vertical.png', mobile: 'fondo-vertical-mobile.webp', desktop: 'fondo-vertical.webp' },
  { input: 'fondo nav.png', mobile: 'fondo-nav-mobile.webp', desktop: 'fondo-nav.webp' },
]

for (const { input, mobile, desktop } of targets) {
  const source = join(publicDir, input)
  if (!existsSync(source)) {
    console.log(`skip (missing): ${input}`)
    continue
  }

  await sharp(source)
    .resize({ width: 750, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(join(publicDir, mobile))

  await sharp(source).webp({ quality: 82 }).toFile(join(publicDir, desktop))

  console.log(`ok: ${input} -> ${mobile}, ${desktop}`)
}
