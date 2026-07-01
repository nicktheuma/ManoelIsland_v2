import type { LatLng, TerrainGeoReference } from '../types/sandbox'
import { bboxFromPolygon, type GeoBounds } from './geo'
import type { TerrainMeshExtentSlice } from './terrainElevation'

/** Fit geo reference to a drawn polygon bounding box (with optional padding). */
export function geoReferenceFromPolygon(
  polygon: LatLng[],
  padding = 1.06,
): Pick<TerrainGeoReference, 'originLat' | 'originLng' | 'spanLat' | 'spanLng'> {
  const bounds = bboxFromPolygon(polygon)
  const originLat = (bounds.north + bounds.south) / 2
  const originLng = (bounds.east + bounds.west) / 2
  return {
    originLat,
    originLng,
    spanLat: Math.max(0.001, (bounds.north - bounds.south) * padding),
    spanLng: Math.max(0.001, (bounds.east - bounds.west) * padding),
  }
}

/** Wider geo reference for low-detail surround terrain. */
export function extendedGeoReference(
  geo: TerrainGeoReference,
  scale = 2.4,
): TerrainGeoReference {
  return {
    ...geo,
    spanLat: geo.spanLat * scale,
    spanLng: geo.spanLng * scale,
  }
}

export function geoBoundsFromReference(geo: TerrainGeoReference): GeoBounds {
  return {
    north: geo.originLat + geo.spanLat / 2,
    south: geo.originLat - geo.spanLat / 2,
    east: geo.originLng + geo.spanLng / 2,
    west: geo.originLng - geo.spanLng / 2,
  }
}

/** Map world XZ to lat/lng using separate width/depth (preserves real-world aspect ratio). */
export function latLngFromWorld(
  x: number,
  z: number,
  geo: TerrainGeoReference,
  extents: TerrainMeshExtentSlice,
): LatLng {
  const lng = geo.originLng + (x / extents.width) * geo.spanLng
  const lat = geo.originLat - (z / extents.depth) * geo.spanLat
  return [lat, lng]
}

export function worldFromLatLng(
  lat: number,
  lng: number,
  geo: TerrainGeoReference,
  extents: TerrainMeshExtentSlice,
): { x: number; z: number } {
  const x = ((lng - geo.originLng) / geo.spanLng) * extents.width
  const z = ((geo.originLat - lat) / geo.spanLat) * extents.depth
  return { x, z }
}

export function worldUvFromLatLng(lat: number, lng: number, geo: TerrainGeoReference): { u: number; v: number } {
  const u = (lng - geo.originLng) / geo.spanLng + 0.5
  const v = 0.5 + (lat - geo.originLat) / geo.spanLat
  return {
    u: Math.min(1, Math.max(0, u)),
    v: Math.min(1, Math.max(0, v)),
  }
}

/** Texture UV from world XZ; matches the lat/lng grid used by heightmap and orthophoto. */
export function worldUvFromWorld(x: number, z: number, extents: TerrainMeshExtentSlice): { u: number; v: number } {
  const u = x / extents.width + 0.5
  const v = 0.5 - z / extents.depth
  return {
    u: Math.min(1, Math.max(0, u)),
    v: Math.min(1, Math.max(0, v)),
  }
}

/** Geo texture UV where u = east, v = 1 at north (matches displaced mesh + orthophoto). */
export function rasterUvFromPixel(col: number, row: number, size: number): { u: number; v: number } {
  return {
    u: col / (size - 1),
    v: 1 - row / (size - 1),
  }
}

export function latLngFromRasterUv(u: number, v: number, geo: TerrainGeoReference): LatLng {
  const lng = geo.originLng + (u - 0.5) * geo.spanLng
  const lat = geo.originLat + (v - 0.5) * geo.spanLat
  return [lat, lng]
}

export function latLngFromRasterPixel(
  col: number,
  row: number,
  size: number,
  geo: TerrainGeoReference,
): LatLng {
  const { u, v } = rasterUvFromPixel(col, row, size)
  return latLngFromRasterUv(u, v, geo)
}

/** @deprecated Use latLngFromRasterPixel — kept as alias for existing imports. */
export function latLngFromGlobalPixel(
  col: number,
  row: number,
  size: number,
  geo: TerrainGeoReference,
): LatLng {
  return latLngFromRasterPixel(col, row, size, geo)
}

export function latLngToGlobalPixel(
  lat: number,
  lng: number,
  size: number,
  geo: TerrainGeoReference,
): { x: number; y: number } {
  const { u, v } = worldUvFromLatLng(lat, lng, geo)
  return {
    x: u * (size - 1),
    y: (1 - v) * (size - 1),
  }
}

export function geoReferenceFromTerrain(terrain: TerrainGeoReference): TerrainGeoReference {
  return {
    originLat: terrain.originLat,
    originLng: terrain.originLng,
    spanLat: terrain.spanLat,
    spanLng: terrain.spanLng,
  }
}
