import { TERRAIN_MAX_HEIGHT, TERRAIN_SIZE } from '../constants/terrain'
import type { TerrainGeoReference } from '../types/sandbox'
import { worldUvFromWorld } from './geoReference'

export function sampleHeightmapPixel(
  imageData: ImageData,
  u: number,
  v: number,
): number {
  const { width, height, data } = imageData
  const x = Math.min(width - 1, Math.max(0, Math.floor(u * (width - 1))))
  const y = Math.min(height - 1, Math.max(0, Math.floor(v * (height - 1))))
  const index = (y * width + x) * 4
  return data[index] / 255
}

export function getTerrainHeightAt(
  x: number,
  z: number,
  imageData: ImageData,
  maxHeight = TERRAIN_MAX_HEIGHT,
  geo?: TerrainGeoReference,
): number {
  const { u, v } = geo
    ? worldUvFromWorld(x, z, geo)
    : { u: x / TERRAIN_SIZE + 0.5, v: 1 - (z / TERRAIN_SIZE + 0.5) }
  return sampleHeightmapPixel(imageData, u, v) * maxHeight
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
  offset = 0.15,
  maxHeight = TERRAIN_MAX_HEIGHT,
  geo?: TerrainGeoReference,
): [number, number, number] {
  return [x, getTerrainHeightAt(x, z, imageData, maxHeight, geo) + offset, z]
}
