import type { TerrainGeoReference } from '../types/sandbox'
import type { TerrainElevationContext, TerrainMeshExtentSlice } from './terrainElevation'
import { normalizedHeightToWorldY } from './terrainElevation'
import { worldUvFromWorld } from './geoReference'
import type { TerrainAlignment } from './terrainAlignment'

export function sampleHeightmapPixel(
  imageData: ImageData,
  u: number,
  v: number,
): number {
  return sampleHeightmapBilinear(imageData, u, v).height
}

export function sampleHeightmapAlpha(imageData: ImageData, u: number, v: number): number {
  return sampleHeightmapBilinear(imageData, u, v).alpha
}

export function sampleHeightmapBilinear(
  imageData: ImageData,
  u: number,
  v: number,
): { height: number; alpha: number } {
  const { width, height, data } = imageData
  const x = Math.min(width - 1, Math.max(0, u * (width - 1)))
  // Raster v = 1 at north; image row 0 = north.
  const y = Math.min(height - 1, Math.max(0, (1 - v) * (height - 1)))

  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = x - x0
  const ty = y - y0

  const sample = (sx: number, sy: number) => {
    const offset = (sy * width + sx) * 4
    return { gray: data[offset] / 255, alpha: data[offset + 3] / 255 }
  }

  const h00 = sample(x0, y0)
  const h10 = sample(x1, y0)
  const h01 = sample(x0, y1)
  const h11 = sample(x1, y1)

  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t

  const gray =
    lerp(lerp(h00.gray, h10.gray, tx), lerp(h01.gray, h11.gray, tx), ty)
  const alpha =
    lerp(lerp(h00.alpha, h10.alpha, tx), lerp(h01.alpha, h11.alpha, tx), ty)

  return { height: gray, alpha }
}

export function getTerrainHeightAt(
  x: number,
  z: number,
  imageData: ImageData,
  geo: TerrainGeoReference,
  elevationCtx: TerrainElevationContext,
  meshExtents: TerrainMeshExtentSlice,
): number {
  const { u, v } = worldUvFromWorld(x, z, meshExtents)
  const sample = sampleHeightmapBilinear(imageData, u, v)
  if (sample.alpha < 0.08) return 0
  return normalizedHeightToWorldY(sample.height, geo, elevationCtx)
}

export function getTerrainHeightAtAligned(
  x: number,
  z: number,
  imageData: ImageData,
  alignment: TerrainAlignment,
  elevationCtx: TerrainElevationContext,
): number {
  return getTerrainHeightAt(
    x,
    z,
    imageData,
    alignment.geo,
    elevationCtx,
    alignment.meshExtents,
  )
}

export function heightmapToImageData(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read heightmap.')
  ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function projectPointOntoTerrain(
  x: number,
  z: number,
  imageData: ImageData,
  alignment: TerrainAlignment,
  elevationCtx: TerrainElevationContext,
  offset = 0.15,
): [number, number, number] {
  return [
    x,
    getTerrainHeightAtAligned(x, z, imageData, alignment, elevationCtx) + offset,
    z,
  ]
}
