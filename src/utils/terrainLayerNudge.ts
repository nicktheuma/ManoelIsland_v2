import * as THREE from 'three'
import type { TerrainLayerNudge, TerrainWaterLayerNudge } from '../types/sandbox'
import type { TerrainMeshExtentSlice } from './terrainElevation'

export const DEFAULT_TERRAIN_LAYER_NUDGE: TerrainLayerNudge = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
}

export const DEFAULT_TERRAIN_WATER_LAYER_NUDGE: TerrainWaterLayerNudge = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  height: 0,
}

const NUDGE_MIN = -100
const NUDGE_MAX = 100
const SCALE_MIN = 0.25
const SCALE_MAX = 4

export function normalizeTerrainLayerNudge(value: Partial<TerrainLayerNudge> | null | undefined): TerrainLayerNudge {
  return {
    x: clampNudge(value?.x, DEFAULT_TERRAIN_LAYER_NUDGE.x),
    y: clampNudge(value?.y, DEFAULT_TERRAIN_LAYER_NUDGE.y),
    scaleX: clampScale(value?.scaleX, DEFAULT_TERRAIN_LAYER_NUDGE.scaleX),
    scaleY: clampScale(value?.scaleY, DEFAULT_TERRAIN_LAYER_NUDGE.scaleY),
  }
}

export function normalizeTerrainWaterLayerNudge(
  value: Partial<TerrainWaterLayerNudge> | null | undefined,
): TerrainWaterLayerNudge {
  const base = normalizeTerrainLayerNudge(value)
  return {
    ...base,
    height: clampNudge(value?.height, DEFAULT_TERRAIN_WATER_LAYER_NUDGE.height),
  }
}

function clampNudge(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(NUDGE_MAX, Math.max(NUDGE_MIN, value))
}

function clampScale(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, value))
}

/** Map texture UV offset matching worldUvFromWorld (v = 1 at north). */
export function layerNudgeToMapUvOffset(
  nudge: TerrainLayerNudge,
  extents: TerrainMeshExtentSlice,
): { u: number; v: number } {
  return {
    u: nudge.x / extents.width,
    v: -nudge.y / extents.depth,
  }
}

/** Apply orthophoto/grid offset + uniform horizontal scale (pivot at raster center). */
export function applyMapTextureLayerNudge(
  texture: THREE.Texture,
  nudge: TerrainLayerNudge,
  extents: TerrainMeshExtentSlice,
): void {
  const scaleX = Math.max(SCALE_MIN, nudge.scaleX)
  const scaleY = Math.max(SCALE_MIN, nudge.scaleY)
  const { u, v } = layerNudgeToMapUvOffset(nudge, extents)

  texture.repeat.set(1 / scaleX, 1 / scaleY)
  texture.offset.set(u + 0.5 * (1 - 1 / scaleX), v + 0.5 * (1 - 1 / scaleY))
}

/** Mesh scale for terrain rotated -π/2 on X (local X → world X, local Y → world −Z). */
export function layerNudgeToMeshScale(nudge: TerrainLayerNudge): [number, number, number] {
  return [Math.max(SCALE_MIN, nudge.scaleX), Math.max(SCALE_MIN, nudge.scaleY), 1]
}

export function layerNudgeToPosition(
  nudge: TerrainLayerNudge,
  baseY = 0,
): [number, number, number] {
  return [nudge.x, baseY, nudge.y]
}

export function layerNudgeToGroupTransform(nudge: TerrainLayerNudge): {
  position: [number, number, number]
  scale: [number, number, number]
} {
  return {
    position: layerNudgeToPosition(nudge),
    scale: [Math.max(SCALE_MIN, nudge.scaleX), 1, Math.max(SCALE_MIN, nudge.scaleY)],
  }
}

/** Base heightmap world XZ → displaced terrain surface world XZ (matches CustomTerrain mesh). */
export function heightmapBaseWorldToSurfaceWorld(
  baseX: number,
  baseZ: number,
  nudge: TerrainLayerNudge,
): { x: number; z: number } {
  const scaleX = Math.max(SCALE_MIN, nudge.scaleX)
  const scaleY = Math.max(SCALE_MIN, nudge.scaleY)
  return {
    x: nudge.x + baseX * scaleX,
    z: nudge.y + baseZ * scaleY,
  }
}

/** Displaced terrain surface world XZ → base heightmap world XZ for raster sampling. */
export function heightmapSurfaceWorldToBaseWorld(
  worldX: number,
  worldZ: number,
  nudge: TerrainLayerNudge,
): { x: number; z: number } {
  const scaleX = Math.max(SCALE_MIN, nudge.scaleX)
  const scaleY = Math.max(SCALE_MIN, nudge.scaleY)
  return {
    x: (worldX - nudge.x) / scaleX,
    z: (worldZ - nudge.y) / scaleY,
  }
}

/** Base water surface Y (MSL + admin level + layer height nudge), excluding animated wave displacement. */
export function waterSurfaceWorldY(
  seaLevelWorldY: number,
  waterNudge: TerrainWaterLayerNudge,
  waterLevel = 0,
): number {
  return seaLevelWorldY + waterLevel + waterNudge.height
}

export function isDefaultLayerNudge(
  nudge: TerrainLayerNudge,
  defaults: TerrainLayerNudge = DEFAULT_TERRAIN_LAYER_NUDGE,
): boolean {
  return (
    nudge.x === defaults.x &&
    nudge.y === defaults.y &&
    nudge.scaleX === defaults.scaleX &&
    nudge.scaleY === defaults.scaleY
  )
}

export function isDefaultWaterLayerNudge(nudge: TerrainWaterLayerNudge): boolean {
  return isDefaultLayerNudge(nudge, DEFAULT_TERRAIN_WATER_LAYER_NUDGE) && nudge.height === 0
}

export { SCALE_MIN, SCALE_MAX }
