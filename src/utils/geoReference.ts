import { TERRAIN_SIZE } from '../constants/terrain'
import type { LatLng, TerrainGeoReference } from '../types/sandbox'
import type { GeoBounds } from './geo'

export function geoBoundsFromReference(geo: TerrainGeoReference): GeoBounds {
  return {
    north: geo.originLat + geo.spanLat / 2,
    south: geo.originLat - geo.spanLat / 2,
    east: geo.originLng + geo.spanLng / 2,
    west: geo.originLng - geo.spanLng / 2,
  }
}

export function latLngFromWorld(x: number, z: number, geo: TerrainGeoReference): LatLng {
  const lng = geo.originLng + (x / TERRAIN_SIZE) * geo.spanLng
  const lat = geo.originLat - (z / TERRAIN_SIZE) * geo.spanLat
  return [lat, lng]
}

export function worldFromLatLng(lat: number, lng: number, geo: TerrainGeoReference): { x: number; z: number } {
  const x = ((lng - geo.originLng) / geo.spanLng) * TERRAIN_SIZE
  const z = ((geo.originLat - lat) / geo.spanLat) * TERRAIN_SIZE
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

export function worldUvFromWorld(x: number, z: number, geo: TerrainGeoReference): { u: number; v: number } {
  const [lat, lng] = latLngFromWorld(x, z, geo)
  return worldUvFromLatLng(lat, lng, geo)
}

export function latLngFromGlobalPixel(
  col: number,
  row: number,
  size: number,
  geo: TerrainGeoReference,
): LatLng {
  const u = col / (size - 1)
  const v = row / (size - 1)
  const lng = geo.originLng + (u - 0.5) * geo.spanLng
  const lat = geo.originLat - (v - 0.5) * geo.spanLat
  return [lat, lng]
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
