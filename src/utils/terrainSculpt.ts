import type { TerrainLayerNudge } from '../types/sandbox'
import { rasterUvFromWorld, worldFromRasterPixel, type TerrainAlignment } from './terrainAlignment'
import type { TerrainElevationContext } from './terrainElevation'
import {
  DEFAULT_TERRAIN_LAYER_NUDGE,
  heightmapBaseWorldToSurfaceWorld,
} from './terrainLayerNudge'

export type SculptTool = 'excavate' | 'fill'

export type TerrainSculptStroke = {
  id?: string
  tool: SculptTool
  centerX: number
  centerZ: number
  radius: number
  strength: number
  terrainKey: string
  createdAt?: string
}

export function terrainSculptKey(terrain: {
  version: number
  sampleSize: number
  originLat: number
  originLng: number
  spanLat: number
  spanLng: number
}): string {
  return `${terrain.version}-${terrain.sampleSize}-${terrain.originLat.toFixed(6)}-${terrain.originLng.toFixed(6)}-${terrain.spanLat.toFixed(6)}-${terrain.spanLng.toFixed(6)}`
}

/** Modify heightmap grayscale in a circular brush (world XZ). Returns true if any pixel changed. */
export function applySculptBrush(
  imageData: ImageData,
  alignment: TerrainAlignment,
  elevationCtx: TerrainElevationContext,
  centerX: number,
  centerZ: number,
  tool: SculptTool,
  radiusWorld: number,
  strengthMeters: number,
  heightmapNudge: TerrainLayerNudge = DEFAULT_TERRAIN_LAYER_NUDGE,
): boolean {
  if (radiusWorld <= 0 || strengthMeters <= 0) return false

  const size = imageData.width
  const scaleX = Math.max(0.25, heightmapNudge.scaleX)
  const scaleY = Math.max(0.25, heightmapNudge.scaleY)
  const baseCenter = {
    x: (centerX - heightmapNudge.x) / scaleX,
    z: (centerZ - heightmapNudge.y) / scaleY,
  }
  const { u, v } = rasterUvFromWorld(baseCenter.x, baseCenter.z, alignment)
  const centerCol = u * (size - 1)
  const centerRow = (1 - v) * (size - 1)

  const pxPerWorldX = size / alignment.meshExtents.width
  const pxPerWorldZ = size / alignment.meshExtents.depth
  const radiusPx = radiusWorld * Math.max(pxPerWorldX / scaleX, pxPerWorldZ / scaleY)

  const minCol = Math.max(0, Math.floor(centerCol - radiusPx))
  const maxCol = Math.min(size - 1, Math.ceil(centerCol + radiusPx))
  const minRow = Math.max(0, Math.floor(centerRow - radiusPx))
  const maxRow = Math.min(size - 1, Math.ceil(centerRow + radiusPx))

  const range = Math.max(0.5, elevationCtx.maxElevationM - elevationCtx.minElevationM)
  const deltaNorm = (strengthMeters / range) * (tool === 'excavate' ? -1 : 1)
  const { data } = imageData
  let changed = false

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const world = worldFromRasterPixel(col, row, size, alignment)
      const surface = heightmapBaseWorldToSurfaceWorld(world.x, world.z, heightmapNudge)
      const dist = Math.hypot(surface.x - centerX, surface.z - centerZ)
      if (dist > radiusWorld) continue

      const offset = (row * size + col) * 4
      if (data[offset + 3] < 20) continue

      const falloff = 1 - dist / radiusWorld
      const gray = data[offset] / 255
      const next = Math.min(1, Math.max(0, gray + deltaNorm * falloff))
      const byte = Math.round(next * 255)
      if (byte !== data[offset]) {
        data[offset] = byte
        data[offset + 1] = byte
        data[offset + 2] = byte
        changed = true
      }
    }
  }

  return changed
}

export function sculptBrushPreviewPosition(
  x: number,
  z: number,
  terrainY: number,
  waterSurfaceY: number,
  waterEnabled: boolean,
  lift = 0.15,
): [number, number, number] {
  const underwater = waterEnabled && terrainY < waterSurfaceY
  const y = (underwater ? waterSurfaceY : terrainY) + lift
  return [x, y, z]
}

export function cloneImageData(source: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(source.data), source.width, source.height)
}
