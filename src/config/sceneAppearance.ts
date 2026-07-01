import type { HdriPresetId, SceneAppearance } from '../types/sandbox'
import { DEFAULT_CAMERA_SETTINGS, normalizeCameraSettings } from './cameraSettings'
import { DEFAULT_TERRAIN_SETTINGS, normalizeTerrainSettings } from './terrainSettings'
import { DEFAULT_FOG_SETTINGS, effectiveCameraFarForFog, normalizeFogSettings } from './fogSettings'
import { DEFAULT_WATER_SETTINGS, normalizeWaterSettings } from './waterSettings'

export const DEFAULT_SCENE_APPEARANCE: SceneAppearance = {
  hdriPreset: 'none',
  backgroundColor: '#0c1222',
  terrainFillColor: '#0f172a',
  terrainFillOpacity: 1,
  terrainGridColor: '#38bdf8',
  terrain: DEFAULT_TERRAIN_SETTINGS,
  camera: DEFAULT_CAMERA_SETTINGS,
  water: DEFAULT_WATER_SETTINGS,
  fog: DEFAULT_FOG_SETTINGS,
}

export const HDRI_OPTIONS: { id: HdriPresetId; label: string }[] = [
  { id: 'none', label: 'None (manual lights)' },
  { id: 'dawn', label: 'Dawn' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'night', label: 'Night' },
  { id: 'forest', label: 'Forest' },
  { id: 'park', label: 'Park' },
  { id: 'city', label: 'City' },
  { id: 'studio', label: 'Studio' },
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'apartment', label: 'Apartment' },
  { id: 'lobby', label: 'Lobby' },
]

export function isHdriPreset(value: string): value is Exclude<HdriPresetId, 'none'> {
  return HDRI_OPTIONS.some((option) => option.id === value && option.id !== 'none')
}

export function normalizeSceneAppearance(
  value: Partial<SceneAppearance> | null | undefined,
): SceneAppearance {
  const hdriPreset = HDRI_OPTIONS.some((option) => option.id === value?.hdriPreset)
    ? (value!.hdriPreset as HdriPresetId)
    : DEFAULT_SCENE_APPEARANCE.hdriPreset

  return {
    hdriPreset,
    backgroundColor: value?.backgroundColor ?? DEFAULT_SCENE_APPEARANCE.backgroundColor,
    terrainFillColor: value?.terrainFillColor ?? DEFAULT_SCENE_APPEARANCE.terrainFillColor,
    terrainFillOpacity: clampOpacity(
      value?.terrainFillOpacity ?? DEFAULT_SCENE_APPEARANCE.terrainFillOpacity,
    ),
    terrainGridColor: value?.terrainGridColor ?? DEFAULT_SCENE_APPEARANCE.terrainGridColor,
    terrain: normalizeTerrainSettings({
      ...DEFAULT_SCENE_APPEARANCE.terrain,
      ...value?.terrain,
    }),
    camera: normalizeCameraSettings({
      ...DEFAULT_SCENE_APPEARANCE.camera,
      ...value?.camera,
    }),
    water: normalizeWaterSettings({
      ...DEFAULT_SCENE_APPEARANCE.water,
      ...value?.water,
    }),
    fog: normalizeFogSettings({
      ...DEFAULT_SCENE_APPEARANCE.fog,
      ...value?.fog,
    }),
  }
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SCENE_APPEARANCE.terrainFillOpacity
  return Math.min(1, Math.max(0, value))
}

/** Normalized appearance with render-time camera far extended to cover fog distance. */
export function sceneAppearanceForRender(
  value: Partial<SceneAppearance> | null | undefined,
): SceneAppearance {
  const normalized = normalizeSceneAppearance(value)
  const cameraFar = effectiveCameraFarForFog(normalized.camera.far, normalized.fog)
  if (cameraFar === normalized.camera.far) return normalized

  return {
    ...normalized,
    camera: normalizeCameraSettings({
      ...normalized.camera,
      far: cameraFar,
    }),
  }
}
