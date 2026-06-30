import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SIZE = 256
const __dirname = dirname(fileURLToPath(import.meta.url))
const outputPath = join(__dirname, '../public/assets/manoel_island_heightmap.png')

function islandHeight(nx, ny) {
  const angle = Math.atan2(ny, nx)
  const radius = Math.hypot(nx, ny)

  const leafMod = 0.38 + (Math.cos(angle - 0.35) * 0.5 + 0.5) * 0.14
  const creekIndent = Math.max(0, 0.12 - Math.hypot(nx + 0.08, ny - 0.22))
  const boundary = leafMod - creekIndent

  if (radius > boundary) return 0

  const falloff = 1 - radius / boundary
  const hill = Math.pow(falloff, 1.35)
  const crown = 1 - Math.pow(radius / boundary, 2.2) * 0.25
  return Math.min(255, Math.round(hill * crown * 220))
}

const pixels = Buffer.alloc(SIZE * SIZE)

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const nx = (x / (SIZE - 1) - 0.5) * 2
    const ny = (y / (SIZE - 1) - 0.5) * 2
    pixels[y * SIZE + x] = islandHeight(nx, ny)
  }
}

mkdirSync(dirname(outputPath), { recursive: true })

await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 1 } })
  .png()
  .toFile(outputPath)

console.log(`Heightmap written to ${outputPath}`)
