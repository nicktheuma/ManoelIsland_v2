import type { TerrainGeoReference } from '../types/sandbox'
import {
  latLngFromWorld,
  latLngFromRasterUv,
  latLngFromRasterPixel,
  rasterUvFromPixel,
  worldFromLatLng,
  worldUvFromLatLng,
  worldUvFromWorld,
} from './geoReference'
import {
  terrainMeshExtents,
  type TerrainElevationContext,
  type TerrainMeshExtents,
  type TerrainMeshExtentSlice,
} from './terrainElevation'

/** Single coordinate frame shared by heightmap, orthophoto, displaced mesh, and OSM props. */
export type TerrainAlignment = {
  geo: TerrainGeoReference
  meshExtents: TerrainMeshExtents
}

export function computeTerrainAlignment(geo: TerrainGeoReference): TerrainAlignment {
  return { geo, meshExtents: terrainMeshExtents(geo) }
}

export function alignmentSlice(alignment: TerrainAlignment): TerrainMeshExtentSlice {
  return alignment.meshExtents
}

/** World XZ from lat/lng using the same meter-scaled extents as the terrain mesh. */
export function worldFromLatLngAligned(
  lat: number,
  lng: number,
  alignment: TerrainAlignment,
): { x: number; z: number } {
  return worldFromLatLng(lat, lng, alignment.geo, alignment.meshExtents)
}

export function latLngFromWorldAligned(
  x: number,
  z: number,
  alignment: TerrainAlignment,
): [number, number] {
  return latLngFromWorld(x, z, alignment.geo, alignment.meshExtents)
}

/** Geo UV used by heightmap + orthophoto rasters (v = 1 at north). */
export function rasterUvFromWorld(x: number, z: number, alignment: TerrainAlignment): { u: number; v: number } {
  return worldUvFromWorld(x, z, alignment.meshExtents)
}

export function worldFromRasterPixel(
  col: number,
  row: number,
  size: number,
  alignment: TerrainAlignment,
): { x: number; z: number } {
  return worldFromRasterPixelRect(col, row, size, size, alignment)
}

/** World XZ from raster pixel using separate width/height (non-square heightmaps). */
export function worldFromRasterPixelRect(
  col: number,
  row: number,
  width: number,
  height: number,
  alignment: TerrainAlignment,
): { x: number; z: number } {
  const u = width > 1 ? col / (width - 1) : 0.5
  const v = height > 1 ? 1 - row / (height - 1) : 0.5
  const [lat, lng] = latLngFromRasterUv(u, v, alignment.geo)
  return worldFromLatLngAligned(lat, lng, alignment)
}

export function rasterUvFromLatLng(
  lat: number,
  lng: number,
  geo: TerrainGeoReference,
): { u: number; v: number } {
  return worldUvFromLatLng(lat, lng, geo)
}

export type { TerrainElevationContext, TerrainMeshExtents, TerrainMeshExtentSlice }

export {
  latLngFromRasterPixel,
  latLngFromRasterUv,
  rasterUvFromPixel,
  worldUvFromWorld,
}
