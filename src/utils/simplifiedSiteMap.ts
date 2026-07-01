import {
  pointInPolygon,
  type LatLng,
} from './geo'
import { geoBoundsFromReference, latLngToGlobalPixel } from './geoReference'
import {
  buildSiteMapOverpassQuery,
  fetchOverpass,
  parseOverpassElements,
  wayLatLngs,
} from './overpass'
import type { TerrainGeoReference } from '../types/sandbox'

export type SimplifiedMapProgress = {
  phase: 'fetch' | 'render'
  progress: number
}

const STYLE = {
  background: '#e9e5dc',
  park: '#c8ddb0',
  woodland: '#b8cfa0',
  water: '#9ecae8',
  building: '#c9bfb0',
  buildingStroke: '#a89888',
  roadMajor: '#ffffff',
  roadMinor: '#f5f2ec',
  roadPath: '#ddd8cc',
  roadCasing: '#b8b0a4',
  tree: '#4a8f4a',
  shrub: '#6aa86a',
} as const

function highwayWidth(tags: Record<string, string> | undefined): number {
  const highway = tags?.highway ?? ''
  if (['motorway', 'trunk', 'primary'].includes(highway)) return 5
  if (['secondary', 'tertiary', 'unclassified', 'residential', 'service'].includes(highway)) return 3.5
  if (['footway', 'path', 'pedestrian', 'cycleway', 'steps'].includes(highway)) return 1.5
  return 2.5
}

function highwayColors(tags: Record<string, string> | undefined): { fill: string; casing: string } {
  const highway = tags?.highway ?? ''
  if (['footway', 'path', 'pedestrian', 'steps', 'cycleway'].includes(highway)) {
    return { fill: STYLE.roadPath, casing: STYLE.roadCasing }
  }
  if (['motorway', 'trunk', 'primary', 'secondary'].includes(highway)) {
    return { fill: STYLE.roadMajor, casing: STYLE.roadCasing }
  }
  return { fill: STYLE.roadMinor, casing: STYLE.roadCasing }
}

function drawPolygonPath(
  ctx: CanvasRenderingContext2D,
  coords: LatLng[],
  geo: TerrainGeoReference,
  size: number,
): void {
  if (coords.length < 2) return

  const first = latLngToGlobalPixel(coords[0][0], coords[0][1], size, geo)
  ctx.moveTo(first.x, first.y)

  for (let i = 1; i < coords.length; i++) {
    const point = latLngToGlobalPixel(coords[i][0], coords[i][1], size, geo)
    ctx.lineTo(point.x, point.y)
  }
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  coords: LatLng[],
  geo: TerrainGeoReference,
  size: number,
  width: number,
  color: string,
  casingColor?: string,
): void {
  if (coords.length < 2) return

  if (casingColor && width > 2) {
    ctx.strokeStyle = casingColor
    ctx.lineWidth = width + 1.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    drawPolygonPath(ctx, coords, geo, size)
    ctx.stroke()
  }

  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  drawPolygonPath(ctx, coords, geo, size)
  ctx.stroke()
}

function applyPolygonMask(
  ctx: CanvasRenderingContext2D,
  polygon: LatLng[],
  geo: TerrainGeoReference,
  size: number,
): void {
  const mask = document.createElement('canvas')
  mask.width = size
  mask.height = size
  const maskCtx = mask.getContext('2d')
  if (!maskCtx) return

  maskCtx.fillStyle = '#000'
  maskCtx.beginPath()
  const first = latLngToGlobalPixel(polygon[0][0], polygon[0][1], size, geo)
  maskCtx.moveTo(first.x, first.y)
  for (let i = 1; i < polygon.length; i++) {
    const point = latLngToGlobalPixel(polygon[i][0], polygon[i][1], size, geo)
    maskCtx.lineTo(point.x, point.y)
  }
  maskCtx.closePath()
  maskCtx.fill()

  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
}

export async function buildSimplifiedSiteMap(
  polygon: LatLng[],
  size: number,
  geo: TerrainGeoReference,
  onProgress?: (progress: SimplifiedMapProgress) => void,
): Promise<{ canvas: HTMLCanvasElement; objectUrl: string; zoom: null }> {
  const bounds = geoBoundsFromReference(geo)

  onProgress?.({ phase: 'fetch', progress: 0 })
  const response = await fetchOverpass(buildSiteMapOverpassQuery(bounds))
  onProgress?.({ phase: 'fetch', progress: 1 })

  const { nodes, ways } = parseOverpassElements(response)

  onProgress?.({ phase: 'render', progress: 0 })

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not render simplified site map.')

  ctx.fillStyle = STYLE.background
  ctx.fillRect(0, 0, size, size)

  const waterAreas = ways.filter(
    (way) => way.tags?.natural === 'water' || way.tags?.waterway,
  )
  const greenAreas = ways.filter(
    (way) =>
      way.tags?.leisure === 'park' ||
      way.tags?.natural === 'wood' ||
      way.tags?.landuse === 'grass' ||
      way.tags?.landuse === 'forest',
  )
  const buildings = ways.filter((way) => way.tags?.building || way.tags?.['building:part'])
  const highways = ways.filter((way) => way.tags?.highway)

  for (const way of waterAreas) {
    const coords = wayLatLngs(way, nodes)
    if (coords.length < 3) continue
    ctx.fillStyle = STYLE.water
    ctx.beginPath()
    drawPolygonPath(ctx, coords, geo, size)
    ctx.closePath()
    ctx.fill()
  }

  for (const way of greenAreas) {
    const coords = wayLatLngs(way, nodes)
    if (coords.length < 3) continue
    ctx.fillStyle = way.tags?.natural === 'wood' || way.tags?.landuse === 'forest' ? STYLE.woodland : STYLE.park
    ctx.beginPath()
    drawPolygonPath(ctx, coords, geo, size)
    ctx.closePath()
    ctx.fill()
  }

  onProgress?.({ phase: 'render', progress: 0.25 })

  for (const way of buildings) {
    const coords = wayLatLngs(way, nodes)
    if (coords.length < 3) continue
    ctx.fillStyle = STYLE.building
    ctx.strokeStyle = STYLE.buildingStroke
    ctx.lineWidth = 0.75
    ctx.beginPath()
    drawPolygonPath(ctx, coords, geo, size)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  onProgress?.({ phase: 'render', progress: 0.55 })

  for (const way of highways) {
    const coords = wayLatLngs(way, nodes)
    const { fill, casing } = highwayColors(way.tags)
    drawPolyline(ctx, coords, geo, size, highwayWidth(way.tags), fill, casing)
  }

  onProgress?.({ phase: 'render', progress: 0.8 })

  for (const element of response.elements) {
    if (element.type !== 'node' || !element.tags) continue
    if (!pointInPolygon(element.lat, element.lon, polygon)) continue

    const point = latLngToGlobalPixel(element.lat, element.lon, size, geo)
    const isTree = element.tags.natural === 'tree'
    const isShrub = element.tags.natural === 'shrub'
    if (!isTree && !isShrub) continue

    ctx.fillStyle = isTree ? STYLE.tree : STYLE.shrub
    ctx.beginPath()
    ctx.arc(point.x, point.y, isTree ? 2.2 : 1.4, 0, Math.PI * 2)
    ctx.fill()
  }

  applyPolygonMask(ctx, polygon, geo, size)

  onProgress?.({ phase: 'render', progress: 1 })

  return { canvas, objectUrl: canvas.toDataURL('image/png'), zoom: null }
}
