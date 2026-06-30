import type { WaterMeshQuality, WaterSettings, WaterStyleId } from '../types/sandbox'
import { TERRAIN_SIZE } from '../constants/terrain'

export const DEFAULT_WATER_PLANE_SIZE = TERRAIN_SIZE * 3

export const WATER_MESH_QUALITY_OPTIONS: { id: WaterMeshQuality; label: string; segments: number }[] = [
  { id: 'low', label: 'Low (fastest)', segments: 48 },
  { id: 'medium', label: 'Medium', segments: 64 },
  { id: 'high', label: 'High', segments: 96 },
]

export const WATER_DETAIL_LAYER_OPTIONS: { id: 0 | 1 | 2; label: string }[] = [
  { id: 0, label: 'Off' },
  { id: 1, label: '1 detail layer' },
  { id: 2, label: '2 detail layers' },
]

export const WATER_STYLE_OPTIONS: { id: WaterStyleId; label: string }[] = [
  { id: 'calm', label: 'Calm swell' },
  { id: 'choppy', label: 'Choppy harbour' },
  { id: 'ripples', label: 'Fine ripples' },
]

export const DEFAULT_WATER_SETTINGS: WaterSettings = {
  enabled: true,
  level: 0,
  planeSize: 530,
  edgeFade: 0.61,
  meshQuality: 'high',
  waveHeight: 0.49,
  waveIntensity: 2.6,
  waveRandomness: 0.25,
  waveSeed: 516,
  detailLayers: 2,
  detailScale: 7.1,
  detailStrength: 0.98,
  animationSpeed: 2.58,
  style: 'ripples',
  color: '#009ceb',
  opacity: 0.42,
  metalness: 1,
  roughness: 0,
}

export function isWaterStyle(value: string): value is WaterStyleId {
  return WATER_STYLE_OPTIONS.some((option) => option.id === value)
}

export function isWaterMeshQuality(value: string): value is WaterMeshQuality {
  return WATER_MESH_QUALITY_OPTIONS.some((option) => option.id === value)
}

export function waterStyleIndex(style: WaterStyleId): number {
  switch (style) {
    case 'choppy':
      return 1
    case 'ripples':
      return 2
    default:
      return 0
  }
}

export function waterMeshSegments(quality: WaterMeshQuality): number {
  return WATER_MESH_QUALITY_OPTIONS.find((option) => option.id === quality)?.segments ?? 64
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function normalizeDetailLayers(value: number | undefined): 0 | 1 | 2 {
  if (value === 1 || value === 2) return value
  return 0
}

export function normalizeWaterSettings(
  value: Partial<WaterSettings> | null | undefined,
): WaterSettings {
  const style = value?.style && isWaterStyle(value.style) ? value.style : DEFAULT_WATER_SETTINGS.style
  const meshQuality =
    value?.meshQuality && isWaterMeshQuality(value.meshQuality)
      ? value.meshQuality
      : DEFAULT_WATER_SETTINGS.meshQuality

  return {
    enabled: value?.enabled ?? DEFAULT_WATER_SETTINGS.enabled,
    level: clamp(value?.level ?? DEFAULT_WATER_SETTINGS.level, -2, 8, DEFAULT_WATER_SETTINGS.level),
    planeSize: clamp(
      value?.planeSize ?? DEFAULT_WATER_SETTINGS.planeSize,
      100,
      2000,
      DEFAULT_WATER_SETTINGS.planeSize,
    ),
    edgeFade: clamp(value?.edgeFade ?? DEFAULT_WATER_SETTINGS.edgeFade, 0, 1, DEFAULT_WATER_SETTINGS.edgeFade),
    meshQuality,
    waveHeight: clamp(
      value?.waveHeight ?? DEFAULT_WATER_SETTINGS.waveHeight,
      0,
      2,
      DEFAULT_WATER_SETTINGS.waveHeight,
    ),
    waveIntensity: clamp(
      value?.waveIntensity ?? DEFAULT_WATER_SETTINGS.waveIntensity,
      0,
      4,
      DEFAULT_WATER_SETTINGS.waveIntensity,
    ),
    waveRandomness: clamp(
      value?.waveRandomness ?? DEFAULT_WATER_SETTINGS.waveRandomness,
      0,
      1,
      DEFAULT_WATER_SETTINGS.waveRandomness,
    ),
    waveSeed: clamp(value?.waveSeed ?? DEFAULT_WATER_SETTINGS.waveSeed, 0, 999, DEFAULT_WATER_SETTINGS.waveSeed),
    detailLayers: normalizeDetailLayers(value?.detailLayers),
    detailScale: clamp(
      value?.detailScale ?? DEFAULT_WATER_SETTINGS.detailScale,
      1,
      10,
      DEFAULT_WATER_SETTINGS.detailScale,
    ),
    detailStrength: clamp(
      value?.detailStrength ?? DEFAULT_WATER_SETTINGS.detailStrength,
      0,
      1,
      DEFAULT_WATER_SETTINGS.detailStrength,
    ),
    animationSpeed: clamp(
      value?.animationSpeed ?? DEFAULT_WATER_SETTINGS.animationSpeed,
      0,
      5,
      DEFAULT_WATER_SETTINGS.animationSpeed,
    ),
    style,
    color: value?.color ?? DEFAULT_WATER_SETTINGS.color,
    opacity: clamp(value?.opacity ?? DEFAULT_WATER_SETTINGS.opacity, 0, 1, DEFAULT_WATER_SETTINGS.opacity),
    metalness: clamp(
      value?.metalness ?? DEFAULT_WATER_SETTINGS.metalness,
      0,
      1,
      DEFAULT_WATER_SETTINGS.metalness,
    ),
    roughness: clamp(
      value?.roughness ?? DEFAULT_WATER_SETTINGS.roughness,
      0,
      1,
      DEFAULT_WATER_SETTINGS.roughness,
    ),
  }
}

export function hexToVec3(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return [0.05, 0.65, 0.91]

  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ]
}
