import type { ShorelinePoint } from './waterShorelineContour'

export const WATER_EDGE_MAX_VERTICES = 64

export type PackedTerrainEdge = {
  count: number
  /** Flat [x0, y0, x1, y1, …] in water-plane local XY (matches shader vLocalPos). */
  vertices: Float32Array
}

export function resampleShorelineForShader(
  contour: ShorelinePoint[],
  maxVertices = WATER_EDGE_MAX_VERTICES,
): ShorelinePoint[] {
  if (contour.length === 0) return []
  if (contour.length <= maxVertices) return contour

  const distances: number[] = [0]
  let total = 0
  for (let i = 0; i < contour.length; i += 1) {
    const a = contour[i]
    const b = contour[(i + 1) % contour.length]
    total += Math.hypot(b.x - a.x, b.z - a.z)
    distances.push(total)
  }

  if (total < 1e-4) return contour.slice(0, maxVertices)

  const result: ShorelinePoint[] = []
  for (let i = 0; i < maxVertices; i += 1) {
    const target = (total * i) / maxVertices
    let seg = 0
    while (seg < contour.length - 1 && distances[seg + 1] < target) seg += 1
    const segStart = distances[seg]
    const segEnd = distances[seg + 1]
    const t = segEnd > segStart ? (target - segStart) / (segEnd - segStart) : 0
    const a = contour[seg]
    const b = contour[(seg + 1) % contour.length]
    result.push({
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
    })
  }
  return result
}

export function packShorelineEdgeVertices(
  contour: ShorelinePoint[],
  waterNudge: { x: number; y: number },
): PackedTerrainEdge {
  const sampled = resampleShorelineForShader(contour)
  const count = Math.min(sampled.length, WATER_EDGE_MAX_VERTICES)
  const vertices = new Float32Array(WATER_EDGE_MAX_VERTICES * 2)

  for (let i = 0; i < count; i += 1) {
    // Water plane local coords: local X = world X − nudge.x, local Y = nudge.y − world Z
    // (PlaneGeometry Y becomes −world Z after the −π/2 X rotation.)
    vertices[i * 2] = sampled[i].x - waterNudge.x
    vertices[i * 2 + 1] = waterNudge.y - sampled[i].z
  }

  return { count, vertices }
}
