import { pointInPolygon, type LatLng } from './geo'
import { geoBoundsFromReference } from './geoReference'
import {
  buildSiteMapOverpassQuery,
  fetchOverpass,
  parseOverpassElements,
  wayLatLngs,
} from './overpass'
import { getTerrainHeightAtAligned } from './terrainHeight'
import { metersToWorldUnits } from './terrainElevation'
import type { TerrainAlignment } from './terrainAlignment'
import { worldFromLatLngAligned } from './terrainAlignment'
import type { TerrainElevationContext } from './terrainElevation'

export type OsmBuildingInstance = {
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
  rotation: number
}

export type OsmTreeInstance = {
  x: number
  y: number
  z: number
  scale: number
}

export type OsmFeatureData = {
  buildings: OsmBuildingInstance[]
  trees: OsmTreeInstance[]
}

const MAX_BUILDINGS = 800
const MAX_TREES = 2500

function parseBuildingHeightMeters(tags: Record<string, string> | undefined): number {
  if (!tags) return 5

  const rawHeight = tags.height ?? tags['building:height']
  if (rawHeight) {
    const meters = Number.parseFloat(rawHeight.replace(/[^\d.]/g, ''))
    if (Number.isFinite(meters)) return Math.min(45, Math.max(2.5, meters))
  }

  const levels = tags['building:levels'] ?? tags.levels
  if (levels) {
    const count = Number.parseInt(levels, 10)
    if (Number.isFinite(count)) return Math.min(45, Math.max(2.5, count * 3))
  }

  switch (tags.building) {
    case 'house':
    case 'residential':
    case 'detached':
    case 'apartments':
      return 7
    case 'commercial':
    case 'retail':
    case 'office':
      return 12
    case 'industrial':
    case 'warehouse':
      return 9
    case 'church':
    case 'cathedral':
    case 'chapel':
      return 14
    case 'garage':
    case 'shed':
    case 'roof':
      return 3
    case 'school':
    case 'hospital':
      return 10
    default:
      return 5
  }
}

function polygonCentroid(coords: LatLng[]): LatLng {
  let lat = 0
  let lng = 0
  for (const [cLat, cLng] of coords) {
    lat += cLat
    lng += cLng
  }
  return [lat / coords.length, lng / coords.length]
}

function footprintMetrics(
  coords: LatLng[],
  alignment: TerrainAlignment,
): { center: { x: number; z: number }; width: number; depth: number; rotation: number } | null {
  if (coords.length < 3) return null

  const world = coords.map(([lat, lng]) => worldFromLatLngAligned(lat, lng, alignment))
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const point of world) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }

  const width = Math.max(1.2, maxX - minX)
  const depth = Math.max(1.2, maxZ - minZ)
  const maxFootprint = metersToWorldUnits(120, alignment.geo)
  if (width > maxFootprint || depth > maxFootprint) return null

  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2

  const first = world[0]
  const second = world[1]
  const rotation = Math.atan2(second.z - first.z, second.x - first.x)

  return { center: { x: centerX, z: centerZ }, width, depth, rotation }
}

function treeInstanceScale(
  isTree: boolean,
  alignment: TerrainAlignment,
  elevationCtx: TerrainElevationContext,
): number {
  const targetMeters = isTree ? 8 : 3.5
  const targetWorld = metersToWorldUnits(targetMeters, alignment.geo) * elevationCtx.exaggeration
  return targetWorld / 2.9
}

export async function buildOsmFeatureData(
  polygon: LatLng[],
  alignment: TerrainAlignment,
  imageData: ImageData,
  elevationCtx: TerrainElevationContext,
  onProgress?: (progress: number) => void,
): Promise<OsmFeatureData> {
  const bounds = geoBoundsFromReference(alignment.geo)
  onProgress?.(0)

  const response = await fetchOverpass(buildSiteMapOverpassQuery(bounds))
  onProgress?.(0.35)

  const { nodes, ways } = parseOverpassElements(response)
  const buildings: OsmBuildingInstance[] = []
  const trees: OsmTreeInstance[] = []

  for (const way of ways) {
    if (!way.tags?.building && !way.tags?.['building:part']) continue

    const coords = wayLatLngs(way, nodes)
    if (coords.length < 3) continue

    const centroid = polygonCentroid(coords)
    if (!pointInPolygon(centroid[0], centroid[1], polygon)) continue

    const metrics = footprintMetrics(coords, alignment)
    if (!metrics) continue

    const heightMeters = parseBuildingHeightMeters(way.tags)
    const heightWorld = metersToWorldUnits(heightMeters, alignment.geo) * elevationCtx.exaggeration
    const groundY = getTerrainHeightAtAligned(
      metrics.center.x,
      metrics.center.z,
      imageData,
      alignment,
      elevationCtx,
    )

    buildings.push({
      x: metrics.center.x,
      y: groundY + heightWorld / 2,
      z: metrics.center.z,
      width: metrics.width,
      height: heightWorld,
      depth: metrics.depth,
      rotation: metrics.rotation,
    })

    if (buildings.length >= MAX_BUILDINGS) break
  }

  onProgress?.(0.7)

  for (const element of response.elements) {
    if (element.type !== 'node' || !element.tags) continue
    if (!pointInPolygon(element.lat, element.lon, polygon)) continue

    const isTree = element.tags.natural === 'tree'
    const isShrub = element.tags.natural === 'shrub'
    if (!isTree && !isShrub) continue

    const { x, z } = worldFromLatLngAligned(element.lat, element.lon, alignment)
    const y = getTerrainHeightAtAligned(x, z, imageData, alignment, elevationCtx)
    const scale = treeInstanceScale(isTree, alignment, elevationCtx)

    trees.push({ x, y, z, scale })
    if (trees.length >= MAX_TREES) break
  }

  onProgress?.(1)
  return { buildings, trees }
}
