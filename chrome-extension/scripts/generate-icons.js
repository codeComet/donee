import sharp from 'sharp'
import { mkdirSync } from 'fs'

mkdirSync('public/icons', { recursive: true })

const sizes = [16, 48, 128]

function createIconSvg(size) {
  const radius = Math.round(size * 0.22)
  const strokeWidth = Math.max(1.5, size * 0.07)
  // Checkmark path: start left, dip to bottom, up to right
  const x1 = size * 0.22, y1 = size * 0.50
  const x2 = size * 0.42, y2 = size * 0.70
  const x3 = size * 0.78, y3 = size * 0.30
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${radius}" fill="#4f46e5"/>
    <polyline
      points="${x1},${y1} ${x2},${y2} ${x3},${y3}"
      stroke="white"
      stroke-width="${strokeWidth}"
      stroke-linecap="round"
      stroke-linejoin="round"
      fill="none"
    />
  </svg>`
}

await Promise.all(
  sizes.map(size =>
    sharp(Buffer.from(createIconSvg(size)))
      .png()
      .toFile(`public/icons/icon${size}.png`)
      .then(() => console.log(`Generated icon${size}.png`))
  )
)
