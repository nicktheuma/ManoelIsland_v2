import {
  chooseTerrariumZoom,
  latLngToTilePixel,
  type GeoBounds,
  type LatLng,
} from './geo'
import { geoBoundsFromReference, latLngFromRasterPixel } from './geoReference'
import type { TerrainGeoReference } from '../types/sandbox'

const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'

type TileKey = string

type TileCanvas = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

function tileKey(z: number, x: number, y: number): TileKey {
  return `${z}/${x}/${y}`
}

function decodeTerrariumElevation(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768
}

async function loadTerrariumTile(z: number, x: number, y: number): Promise<TileCanvas> {
  const response = await fetch(`${TERRARIUM_URL}/${z}/${x}/${y}.png`)
  if (!response.ok) throw new Error(`Failed to load elevation tile ${z}/${x}/${y}`)

  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Could not read elevation tile.')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  return { canvas, ctx }
}

function sampleElevationFromTiles(
  lat: number,
  lng: number,
  zoom: number,
  tiles: Map<TileKey, TileCanvas>,
): number | null {
  const { tileX, tileY, pixelX, pixelY } = latLngToTilePixel(lat, lng, zoom)
  const tile = tiles.get(tileKey(zoom, tileX, tileY))
  if (!tile) return null

  const data = tile.ctx.getImageData(pixelX, pixelY, 1, 1).data
  return decodeTerrariumElevation(data[0], data[1], data[2])
}

async function loadTilesForBounds(bounds: GeoBounds, zoom: number): Promise<Map<TileKey, TileCanvas>> {
  const northWest = latLngToTilePixel(bounds.north, bounds.west, zoom)
  const southEast = latLngToTilePixel(bounds.south, bounds.east, zoom)

  const minX = Math.min(northWest.tileX, southEast.tileX) - 1
  const maxX = Math.max(northWest.tileX, southEast.tileX) + 1
  const minY = Math.min(northWest.tileY, southEast.tileY) - 1
  const maxY = Math.max(northWest.tileY, southEast.tileY) + 1

  const tiles = new Map<TileKey, TileCanvas>()
  const jobs: Promise<void>[] = []

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      jobs.push(
        loadTerrariumTile(zoom, x, y).then((tile) => {
          tiles.set(tileKey(zoom, x, y), tile)
        }),
      )
    }
  }

  await Promise.all(jobs)
  return tiles
}

export type DemSampleProgress = {
  phase: 'tiles' | 'sampling'
  progress: number
}

export async function sampleDemGrid(
  polygon: LatLng[],
  size: number,
  geo: TerrainGeoReference,
  onProgress?: (progress: DemSampleProgress) => void,
): Promise<{ elevations: Float32Array; min: number; max: number; zoom: number }> {
  const bounds = geoBoundsFromReference(geo)
  const zoom = chooseTerrariumZoom(bounds)

  onProgress?.({ phase: 'tiles', progress: 0 })
  const tiles = await loadTilesForBounds(bounds, zoom)
  onProgress?.({ phase: 'sampling', progress: 0 })

  const elevations = new Float32Array(size * size)
  let min = Infinity
  let max = -Infinity
  let samples = 0
  const total = size * size

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const [lat, lng] = latLngFromRasterPixel(col, row, size, geo)
      const index = row * size + col

      if (!pointInPolygonFast(lat, lng, polygon)) {
        elevations[index] = Number.NaN
        continue
      }

      const elevation = sampleElevationFromTiles(lat, lng, zoom, tiles)
      elevations[index] = elevation ?? Number.NaN

      if (Number.isFinite(elevation)) {
        min = Math.min(min, elevation!)
        max = Math.max(max, elevation!)
      }

      samples++
      if (samples % 32 === 0) {
        onProgress?.({ phase: 'sampling', progress: (row * size + col) / total })
      }
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('No elevation samples found inside the selected outline.')
  }

  return { elevations, min, max, zoom }
}

/** Sample elevation for the full geo bounding box (no polygon mask). */
export async function sampleDemGridFull(
  size: number,
  geo: TerrainGeoReference,
  onProgress?: (progress: DemSampleProgress) => void,
): Promise<{ elevations: Float32Array; min: number; max: number; zoom: number }> {
  const bounds = geoBoundsFromReference(geo)
  const zoom = chooseTerrariumZoom(bounds)

  onProgress?.({ phase: 'tiles', progress: 0 })
  const tiles = await loadTilesForBounds(bounds, zoom)
  onProgress?.({ phase: 'sampling', progress: 0 })

  const elevations = new Float32Array(size * size)
  let min = Infinity
  let max = -Infinity
  const total = size * size

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const [lat, lng] = latLngFromRasterPixel(col, row, size, geo)
      const index = row * size + col
      const elevation = sampleElevationFromTiles(lat, lng, zoom, tiles)
      elevations[index] = elevation ?? Number.NaN

      if (Number.isFinite(elevation)) {
        min = Math.min(min, elevation!)
        max = Math.max(max, elevation!)
      }

      if ((row * size + col) % 32 === 0) {
        onProgress?.({ phase: 'sampling', progress: (row * size + col) / total })
      }
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('No elevation samples found in the selected area.')
  }

  return { elevations, min, max, zoom }
}

function pointInPolygonFast(lat: number, lng: number, polygon: LatLng[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]
    const [yj, xj] = polygon[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi) {
      inside = !inside
    }
  }
  return inside
}

export function elevationsToGrayscaleImageData(
  elevations: Float32Array,
  size: number,
  min: number,
  max: number,
): ImageData {
  const range = Math.max(0.5, max - min)
  const data = new Uint8ClampedArray(size * size * 4)

  for (let i = 0; i < size * size; i++) {
    const value = elevations[i]
    const normalized = Number.isFinite(value) ? (value - min) / range : 0
    const gray = Math.round(Math.min(1, Math.max(0, normalized)) * 255)
    const offset = i * 4
    data[offset] = gray
    data[offset + 1] = gray
    data[offset + 2] = gray
    data[offset + 3] = Number.isFinite(value) ? 255 : 0
  }

  return new ImageData(data, size, size)
}

export function imageDataToObjectUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not encode heightmap.')
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export async function buildHeightmapFromPolygon(
  polygon: LatLng[],
  size: number,
  geo: TerrainGeoReference,
  onProgress?: (progress: DemSampleProgress) => void,
): Promise<{ imageData: ImageData; objectUrl: string; min: number; max: number; zoom: number }> {
  const { elevations, min, max, zoom } = await sampleDemGrid(polygon, size, geo, onProgress)
  const imageData = elevationsToGrayscaleImageData(elevations, size, min, max)
  const objectUrl = imageDataToObjectUrl(imageData)
  return { imageData, objectUrl, min, max, zoom }
}
