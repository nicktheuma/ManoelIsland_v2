import {
  chooseImageryZoom,
  latLngToWorldPixel,
  pointInPolygon,
  type GeoBounds,
  type LatLng,
} from './geo'
import { geoBoundsFromReference, latLngFromGlobalPixel } from './geoReference'
import type { TerrainGeoReference } from '../types/sandbox'

type TileKey = string

type TileCanvas = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

export type TileFetchProgress = {
  phase: 'tiles' | 'compositing'
  progress: number
}

function tileKey(z: number, x: number, y: number): TileKey {
  return `${z}/${x}/${y}`
}

async function loadTileImage(url: string): Promise<TileCanvas> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to load map tile (${response.status}).`)

  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read map tile.')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  return { canvas, ctx }
}

function sampleTile(
  tiles: Map<TileKey, TileCanvas>,
  zoom: number,
  worldX: number,
  worldY: number,
): [number, number, number, number] | null {
  const tileX = Math.floor(worldX / 256)
  const tileY = Math.floor(worldY / 256)
  const pixelX = Math.min(255, Math.max(0, Math.floor(worldX - tileX * 256)))
  const pixelY = Math.min(255, Math.max(0, Math.floor(worldY - tileY * 256)))

  const tile = tiles.get(tileKey(zoom, tileX, tileY))
  if (!tile) return null

  const data = tile.ctx.getImageData(pixelX, pixelY, 1, 1).data
  return [data[0], data[1], data[2], data[3]]
}

async function loadTilesForBounds(
  bounds: GeoBounds,
  zoom: number,
  tileUrl: (z: number, x: number, y: number) => string,
  onProgress?: (progress: TileFetchProgress) => void,
): Promise<Map<TileKey, TileCanvas>> {
  const northWest = latLngToWorldPixel(bounds.north, bounds.west, zoom)
  const southEast = latLngToWorldPixel(bounds.south, bounds.east, zoom)

  const minX = Math.floor(Math.min(northWest.x, southEast.x) / 256) - 1
  const maxX = Math.floor(Math.max(northWest.x, southEast.x) / 256) + 1
  const minY = Math.floor(Math.min(northWest.y, southEast.y) / 256) - 1
  const maxY = Math.floor(Math.max(northWest.y, southEast.y) / 256) + 1

  const tiles = new Map<TileKey, TileCanvas>()
  const jobs: Promise<void>[] = []
  const total = (maxX - minX + 1) * (maxY - minY + 1)
  let loaded = 0

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      jobs.push(
        loadTileImage(tileUrl(zoom, x, y)).then((tile) => {
          tiles.set(tileKey(zoom, x, y), tile)
          loaded++
          if (loaded % 2 === 0) {
            onProgress?.({ phase: 'tiles', progress: loaded / total })
          }
        }),
      )
    }
  }

  await Promise.all(jobs)
  onProgress?.({ phase: 'tiles', progress: 1 })
  return tiles
}

export async function buildMaskedRasterSurface(
  polygon: LatLng[],
  size: number,
  geo: TerrainGeoReference,
  tileUrl: (z: number, x: number, y: number) => string,
  onProgress?: (progress: TileFetchProgress) => void,
): Promise<{ canvas: HTMLCanvasElement; objectUrl: string; zoom: number }> {
  const bounds = geoBoundsFromReference(geo)
  const zoom = chooseImageryZoom(bounds)

  onProgress?.({ phase: 'tiles', progress: 0 })
  const tiles = await loadTilesForBounds(bounds, zoom, tileUrl, onProgress)

  onProgress?.({ phase: 'compositing', progress: 0 })

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not compose map surface.')

  const imageData = ctx.createImageData(size, size)
  const data = imageData.data

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const [lat, lng] = latLngFromGlobalPixel(col, row, size, geo)
      const offset = (row * size + col) * 4

      if (!pointInPolygon(lat, lng, polygon)) {
        data[offset + 3] = 0
        continue
      }

      const { x, y } = latLngToWorldPixel(lat, lng, zoom)
      const sample = sampleTile(tiles, zoom, x, y)

      if (!sample) {
        data[offset + 3] = 0
        continue
      }

      data[offset] = sample[0]
      data[offset + 1] = sample[1]
      data[offset + 2] = sample[2]
      data[offset + 3] = sample[3]
    }

    if (row % 8 === 0) {
      onProgress?.({ phase: 'compositing', progress: row / (size - 1) })
    }
  }

  ctx.putImageData(imageData, 0, 0)
  onProgress?.({ phase: 'compositing', progress: 1 })

  return { canvas, objectUrl: canvas.toDataURL('image/png'), zoom }
}

const ESRI_WORLD_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile'

export async function buildOrthophotoSurface(
  polygon: LatLng[],
  size: number,
  geo: TerrainGeoReference,
  onProgress?: (progress: TileFetchProgress) => void,
): Promise<{ canvas: HTMLCanvasElement; objectUrl: string; zoom: number }> {
  return buildMaskedRasterSurface(
    polygon,
    size,
    geo,
    (z, x, y) => `${ESRI_WORLD_IMAGERY}/${z}/${y}/${x}`,
    onProgress,
  )
}
