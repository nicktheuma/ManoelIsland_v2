import type { TerrainMeshQuality, TerrainSettings } from '../types/sandbox'

export const TERRAIN_MESH_QUALITY_OPTIONS: { id: TerrainMeshQuality; label: string; segments: number }[] = [
  { id: 'low', label: 'Low (128 segments)', segments: 128 },
  { id: 'medium', label: 'Medium (192 segments)', segments: 192 },
  { id: 'high', label: 'High (256 segments)', segments: 256 },
  { id: 'ultra', label: 'Ultra (320 segments)', segments: 320 },
]

export function terrainMeshSegments(quality: TerrainMeshQuality): number {
  return TERRAIN_MESH_QUALITY_OPTIONS.find((option) => option.id === quality)?.segments ?? 256
}

export function effectiveSurfaceSampleSize(terrain: TerrainSettings): number {
  return terrain.surfaceSampleSize ?? terrain.sampleSize
}
