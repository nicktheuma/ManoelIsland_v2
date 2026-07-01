import type { LatLng, TerrainLayerNudge } from '../types/sandbox'
import { pointInPolygon } from './geo'
import { latLngFromRasterUv } from './geoReference'
import { normalizedHeightToWorldY, type TerrainElevationContext } from './terrainElevation'
import { heightmapBaseWorldToSurfaceWorld } from './terrainLayerNudge'
import { sampleHeightmapBilinear } from './terrainHeight'
import { rasterUvFromWorld, worldFromRasterPixelRect, type TerrainAlignment } from './terrainAlignment'

export type ShorelinePoint = { x: number; z: number }

type CornerKind = 'land' | 'water' | 'void'

type Corner = {
  x: number
  z: number
  height: number
  kind: CornerKind
}

function quantKey(p: ShorelinePoint, precision = 0.25): string {
  return `${Math.round(p.x / precision)}:${Math.round(p.z / precision)}`
}

function edgeCrossing(a: Corner, b: Corner, threshold: number): ShorelinePoint | null {
  const denom = b.height - a.height
  if (Math.abs(denom) < 1e-6) return null
  const t = (threshold - a.height) / denom
  if (t < 0 || t > 1) return null
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  }
}

function cornerAt(
  col: number,
  row: number,
  width: number,
  height: number,
  imageData: ImageData,
  alignment: TerrainAlignment,
  elevationCtx: TerrainElevationContext,
  polygon: LatLng[],
  waterY: number,
): Corner {
  const { x, z } = worldFromRasterPixelRect(col, row, width, height, alignment)
  const u = width > 1 ? col / (width - 1) : 0.5
  const v = height > 1 ? 1 - row / (height - 1) : 0.5
  const [lat, lng] = latLngFromRasterUv(u, v, alignment.geo)
  const inside = polygon.length >= 3 && pointInPolygon(lat, lng, polygon)

  if (!inside) {
    return { x, z, height: waterY - 1, kind: 'water' }
  }

  const { u: sampleU, v: sampleV } = rasterUvFromWorld(x, z, alignment)
  const sample = sampleHeightmapBilinear(imageData, sampleU, sampleV)
  if (sample.alpha < 0.08) {
    return { x, z, height: 0, kind: 'void' }
  }

  const terrainY = normalizedHeightToWorldY(sample.height, alignment.geo, elevationCtx)
  const landThreshold = waterY - 0.02
  return {
    x,
    z,
    height: terrainY,
    kind: terrainY >= landThreshold ? 'land' : 'water',
  }
}

function toSurfacePoint(point: ShorelinePoint, nudge: TerrainLayerNudge): ShorelinePoint {
  const surface = heightmapBaseWorldToSurfaceWorld(point.x, point.z, nudge)
  return { x: surface.x, z: surface.z }
}

function processCell(
  tl: Corner,
  tr: Corner,
  br: Corner,
  bl: Corner,
  landThreshold: number,
  nudge: TerrainLayerNudge,
  segments: Array<[ShorelinePoint, ShorelinePoint]>,
) {
  const edges: [Corner, Corner][] = [
    [tl, tr],
    [tr, br],
    [br, bl],
    [bl, tl],
  ]

  const crossings: ShorelinePoint[] = []
  for (const [a, b] of edges) {
    if (a.kind === 'void' || b.kind === 'void' || a.kind === b.kind) continue
    const crossing = edgeCrossing(a, b, landThreshold)
    if (crossing) crossings.push(crossing)
  }

  if (crossings.length === 2) {
    segments.push([
      toSurfacePoint(crossings[0], nudge),
      toSurfacePoint(crossings[1], nudge),
    ])
    return
  }

  if (crossings.length === 4) {
    const avgHeight = (tl.height + tr.height + br.height + bl.height) / 4
    if (avgHeight >= landThreshold) {
      segments.push([
        toSurfacePoint(crossings[0], nudge),
        toSurfacePoint(crossings[1], nudge),
      ])
      segments.push([
        toSurfacePoint(crossings[2], nudge),
        toSurfacePoint(crossings[3], nudge),
      ])
    } else {
      segments.push([
        toSurfacePoint(crossings[0], nudge),
        toSurfacePoint(crossings[3], nudge),
      ])
      segments.push([
        toSurfacePoint(crossings[1], nudge),
        toSurfacePoint(crossings[2], nudge),
      ])
    }
  }
}

function chainSegments(segments: Array<[ShorelinePoint, ShorelinePoint]>): ShorelinePoint[][] {
  const points = new Map<string, ShorelinePoint>()
  const adjacency = new Map<string, string[]>()

  for (const [a, b] of segments) {
    const keyA = quantKey(a)
    const keyB = quantKey(b)
    points.set(keyA, a)
    points.set(keyB, b)
    if (!adjacency.has(keyA)) adjacency.set(keyA, [])
    if (!adjacency.has(keyB)) adjacency.set(keyB, [])
    adjacency.get(keyA)!.push(keyB)
    adjacency.get(keyB)!.push(keyA)
  }

  const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const usedEdges = new Set<string>()
  const loops: ShorelinePoint[][] = []
  const maxLoopSteps = Math.max(segments.length + 1, 8)

  for (const [startKey] of adjacency) {
    for (const neighborKey of adjacency.get(startKey) ?? []) {
      const startEdge = edgeKey(startKey, neighborKey)
      if (usedEdges.has(startEdge)) continue

      const loop: ShorelinePoint[] = [points.get(startKey)!]
      let previousKey = startKey
      let currentKey = neighborKey
      usedEdges.add(startEdge)
      let steps = 0

      while (currentKey !== startKey && steps < maxLoopSteps) {
        steps += 1
        loop.push(points.get(currentKey)!)
        const nextCandidates = (adjacency.get(currentKey) ?? []).filter((key) => key !== previousKey)
        if (nextCandidates.length === 0) break

        let nextKey: string | null = null
        for (const candidate of nextCandidates) {
          const candidateEdge = edgeKey(currentKey, candidate)
          if (!usedEdges.has(candidateEdge)) {
            nextKey = candidate
            break
          }
        }
        if (!nextKey) break

        usedEdges.add(edgeKey(currentKey, nextKey))
        previousKey = currentKey
        currentKey = nextKey
      }

      if (currentKey === startKey && loop.length >= 3) loops.push(loop)
    }
  }

  return loops
}

function loopPerimeter(loop: ShorelinePoint[]): number {
  let total = 0
  for (let i = 0; i < loop.length; i += 1) {
    const a = loop[i]
    const b = loop[(i + 1) % loop.length]
    total += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return total
}

function signedArea(loop: ShorelinePoint[]): number {
  let area = 0
  for (let i = 0; i < loop.length; i += 1) {
    const a = loop[i]
    const b = loop[(i + 1) % loop.length]
    area += a.x * b.z - b.x * a.z
  }
  return area * 0.5
}

/** Coarser grid for large heightmaps — keeps contour shape, cuts CPU cost ~stride². */
function contourStride(width: number, height: number): number {
  const cells = Math.max(1, width - 1) * Math.max(1, height - 1)
  if (cells > 200 * 200) return 4
  if (cells > 128 * 128) return 2
  return 1
}

/**
 * Extract the shoreline where emergent terrain meets water at the water plane,
 * including the crop boundary where terrain ends and open water begins.
 */
export function computeWaterShorelineContour(
  imageData: ImageData,
  alignment: TerrainAlignment,
  elevationCtx: TerrainElevationContext,
  polygon: LatLng[],
  waterWorldY: number,
  heightmapNudge: TerrainLayerNudge,
): ShorelinePoint[] {
  const width = imageData.width
  const height = imageData.height
  if (width < 2 || height < 2 || polygon.length < 3) return []

  const landThreshold = waterWorldY - 0.02
  const segments: Array<[ShorelinePoint, ShorelinePoint]> = []
  const stride = contourStride(width, height)

  for (let row = 0; row < height - 1; row += stride) {
    for (let col = 0; col < width - 1; col += stride) {
      const colR = Math.min(col + stride, width - 1)
      const rowB = Math.min(row + stride, height - 1)
      const tl = cornerAt(col, row, width, height, imageData, alignment, elevationCtx, polygon, waterWorldY)
      const tr = cornerAt(
        colR,
        row,
        width,
        height,
        imageData,
        alignment,
        elevationCtx,
        polygon,
        waterWorldY,
      )
      const br = cornerAt(
        colR,
        rowB,
        width,
        height,
        imageData,
        alignment,
        elevationCtx,
        polygon,
        waterWorldY,
      )
      const bl = cornerAt(
        col,
        rowB,
        width,
        height,
        imageData,
        alignment,
        elevationCtx,
        polygon,
        waterWorldY,
      )

      processCell(tl, tr, br, bl, landThreshold, heightmapNudge, segments)
    }
  }

  if (segments.length === 0) return []

  const loops = chainSegments(segments)
  if (loops.length === 0) return []

  let best = loops[0]
  let bestPerimeter = loopPerimeter(best)
  for (const loop of loops) {
    const perimeter = loopPerimeter(loop)
    if (perimeter > bestPerimeter) {
      bestPerimeter = perimeter
      best = loop
    }
  }

  if (bestPerimeter < 1) return []

  if (signedArea(best) < 0) best.reverse()
  return best
}
