import { TERRAIN_SIZE } from '../constants/terrain'
import type { TerrainGeoReference, TerrainSettings } from '../types/sandbox'

const METERS_PER_DEGREE_LAT = 111_320

export function metersPerDegreeLng(lat: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180)
}

export type TerrainMeshExtents = {
  /** World-space width (X / east–west). */
  width: number
  /** World-space depth (Z / north–south). */
  depth: number
  widthMeters: number
  depthMeters: number
  worldUnitsPerMeter: number
}

export function terrainExtentsMeters(geo: TerrainGeoReference): {
  widthMeters: number
  depthMeters: number
} {
  return {
    widthMeters: geo.spanLng * metersPerDegreeLng(geo.originLat),
    depthMeters: geo.spanLat * METERS_PER_DEGREE_LAT,
  }
}

/** Uniform horizontal scale: one world unit equals the same distance on both axes. */
export function worldUnitsPerMeter(geo: TerrainGeoReference): number {
  const { widthMeters, depthMeters } = terrainExtentsMeters(geo)
  return TERRAIN_SIZE / Math.max(widthMeters, depthMeters)
}

export function terrainMeshExtents(
  geo: TerrainGeoReference,
  uniformWorldUnitsPerMeter?: number,
): TerrainMeshExtents {
  const { widthMeters, depthMeters } = terrainExtentsMeters(geo)
  const wupm = uniformWorldUnitsPerMeter ?? worldUnitsPerMeter(geo)
  return {
    width: widthMeters * wupm,
    depth: depthMeters * wupm,
    widthMeters,
    depthMeters,
    worldUnitsPerMeter: wupm,
  }
}

export function metersToWorldUnits(meters: number, geo: TerrainGeoReference): number {
  return meters * worldUnitsPerMeter(geo)
}

export type TerrainElevationContext = {
  minElevationM: number
  maxElevationM: number
  seaLevelM: number
  exaggeration: number
}

export function terrainElevationContextFromSettings(
  terrain: Pick<TerrainSettings, 'lastMinElevation' | 'lastMaxElevation' | 'maxHeight' | 'source'>,
): TerrainElevationContext {
  const hasDemRange =
    terrain.source === 'dem' &&
    terrain.lastMinElevation !== null &&
    terrain.lastMaxElevation !== null

  return {
    minElevationM: hasDemRange ? terrain.lastMinElevation! : 0,
    maxElevationM: hasDemRange ? terrain.lastMaxElevation! : 30,
    seaLevelM: 0,
    exaggeration: Math.max(0.25, terrain.maxHeight),
  }
}

export function normalizedHeightToWorldY(
  normalized: number,
  geo: TerrainGeoReference,
  ctx: TerrainElevationContext,
): number {
  const range = Math.max(0.5, ctx.maxElevationM - ctx.minElevationM)
  const elevationM = ctx.minElevationM + normalized * range
  return (elevationM - ctx.seaLevelM) * worldUnitsPerMeter(geo) * ctx.exaggeration
}

export function elevationMToWorldY(
  elevationM: number,
  geo: TerrainGeoReference,
  ctx: TerrainElevationContext,
): number {
  return (elevationM - ctx.seaLevelM) * worldUnitsPerMeter(geo) * ctx.exaggeration
}

/** World Y of mean sea level (MSL). All layers should clip/place against this value. */
export function seaLevelWorldY(
  geo: TerrainGeoReference,
  ctx: TerrainElevationContext,
): number {
  return elevationMToWorldY(ctx.seaLevelM, geo, ctx)
}

export function elevationMFromNormalized(
  normalized: number,
  ctx: TerrainElevationContext,
): number {
  const range = Math.max(0.5, ctx.maxElevationM - ctx.minElevationM)
  return ctx.minElevationM + normalized * range
}

export type TerrainMeshExtentSlice = Pick<TerrainMeshExtents, 'width' | 'depth'>
