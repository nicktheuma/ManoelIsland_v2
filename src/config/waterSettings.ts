import type {
  WaterBaseNormalSettings,
  WaterEdgeRippleSettings,
  WaterMeshQuality,
  WaterNormalLayerSettings,
  WaterSettings,
  WaterStyleId,
} from '../types/sandbox'
import { TERRAIN_SIZE } from '../constants/terrain'

export const DEFAULT_WATER_PLANE_SIZE = TERRAIN_SIZE * 3

export const WATER_WAVE_SCALE_MIN = 0.001
export const WATER_WAVE_SCALE_MAX = 500
export const WATER_DETAIL_SCALE_MIN = 0.1
export const WATER_DETAIL_SCALE_MAX = 200
export const WATER_NORMAL_MAP_STRENGTH_MAX = 1
export const WATER_NORMAL_MAP_SCALE_MIN = 0.05
export const WATER_NORMAL_MAP_SCALE_MAX = 30
export const WATER_NORMAL_MAP_WAVE_SCALE_MIN = 0.001
export const WATER_NORMAL_MAP_WAVE_SCALE_MAX = 200
export const WATER_NORMAL_MAP_SPEED_MAX = 5
export const WATER_NORMAL_COLOR_SCALE_MAX = 3
export const WATER_DISTORTION_MAX = 2
export const WATER_DISTORTION_SPEED_MAX = 2
export const WATER_DISTORTION_SLIDER_SCALE = 1000

export const WATER_EDGE_RIPPLE_STRENGTH_MAX = 1
export const WATER_EDGE_RIPPLE_SPEED_MAX = 5
export const WATER_EDGE_RIPPLE_WAVE_SCALE_MIN = 0.01
export const WATER_EDGE_RIPPLE_WAVE_SCALE_MAX = 2
export const WATER_EDGE_RIPPLE_FALLOFF_MAX = 0.2
export const WATER_EDGE_RIPPLE_MAX_DISTANCE_MAX = 500

export const WATER_MESH_QUALITY_OPTIONS: { id: WaterMeshQuality; label: string; segments: number }[] = [
  { id: 'low', label: 'Low (64)', segments: 64 },
  { id: 'medium', label: 'Medium (96)', segments: 96 },
  { id: 'high', label: 'High (144)', segments: 144 },
  { id: 'ultra', label: 'Ultra (224)', segments: 224 },
  { id: 'extreme', label: 'Extreme (320)', segments: 320 },
  { id: 'superior', label: 'Superior (448)', segments: 448 },
  { id: 'insane', label: 'Insane (576)', segments: 576 },
  { id: 'maximum', label: 'Maximum (704)', segments: 704 },
]

export const DEFAULT_WATER_BASE_NORMAL_MAP: WaterBaseNormalSettings = {
  waveScale: 1,
  stretchX: 1,
  stretchZ: 1,
  randomness: 0,
  speed: 1,
  strength: 1,
  shape: 'calm',
  distortion: 0,
  distortionSpeed: 1,
}

export const WATER_NORMAL_LAYER_STRENGTH_MAX = 1
export const WATER_NORMAL_LAYER_STRETCH_MIN = 0.1
export const WATER_NORMAL_LAYER_STRETCH_MAX = 10
export const WATER_NORMAL_LAYER_COUNT = 4

export const WATER_NORMAL_LAYER_OPTIONS: { id: WaterSettings['normalLayers']; label: string }[] = [
  { id: 0, label: 'Off' },
  { id: 1, label: '1 normal layer' },
  { id: 2, label: '2 normal layers' },
  { id: 3, label: '3 normal layers' },
  { id: 4, label: '4 normal layers' },
]

export const DEFAULT_WATER_NORMAL_LAYER_SETTINGS: [
  WaterNormalLayerSettings,
  WaterNormalLayerSettings,
  WaterNormalLayerSettings,
  WaterNormalLayerSettings,
] = [
  { waveScale: 1.8, stretchX: 1, stretchZ: 1, randomness: 0, speed: 0.7, strength: 0.45, distortion: 0, distortionSpeed: 1 },
  { waveScale: 4, stretchX: 1, stretchZ: 1, randomness: 0, speed: 1, strength: 0.7, distortion: 0, distortionSpeed: 1 },
  { waveScale: 12, stretchX: 1, stretchZ: 1, randomness: 0, speed: 1.3, strength: 0.4, distortion: 0, distortionSpeed: 1 },
  { waveScale: 36, stretchX: 1, stretchZ: 1, randomness: 0, speed: 1.8, strength: 0.25, distortion: 0, distortionSpeed: 1 },
]

export const WATER_DETAIL_LAYER_OPTIONS: { id: WaterSettings['detailLayers']; label: string }[] = [
  { id: 0, label: 'Off' },
  { id: 1, label: '1 detail layer' },
  { id: 2, label: '2 detail layers' },
  { id: 3, label: '3 detail layers' },
  { id: 4, label: '4 detail layers' },
]

export const WATER_STYLE_OPTIONS: { id: WaterStyleId; label: string }[] = [
  { id: 'calm', label: 'Calm swell' },
  { id: 'choppy', label: 'Choppy harbour' },
  { id: 'ripples', label: 'Fine ripples' },
]

export const WATER_EDGE_RIPPLE_SOFTNESS_MAX = 1
export const WATER_SHORELINE_FADE_DISTANCE_MAX = 80

export const DEFAULT_WATER_EDGE_RIPPLES: WaterEdgeRippleSettings = {
  enabled: true,
  strength: 0.4,
  speed: 1.5,
  waveScale: 0.25,
  falloff: 0.035,
  maxDistance: 150,
  displacementStrength: 0.35,
  normalStrength: 0.55,
  softness: 0.5,
}

export const DEFAULT_WATER_SETTINGS: WaterSettings = {
  enabled: true,
  level: 0,
  planeSize: 530,
  edgeFade: 0.61,
  shorelineFadeDistance: 18,
  shorelineFadeStrength: 1,
  meshQuality: 'high',
  waveHeight: 0.49,
  waveIntensity: 2.6,
  waveRandomness: 0,
  waveSeed: 516,
  waveScale: 1,
  detailLayers: 2,
  detailScale: 7.1,
  detailStrength: 0.75,
  displacementDistortion: 0,
  displacementDistortionSpeed: 1,
  detailDistortion: 0,
  detailDistortionSpeed: 1,
  animationSpeed: 2.58,
  style: 'calm',
  color: '#009ceb',
  normalHighlightColor: '#b8f0ff',
  normalShadowColor: '#043a5c',
  normalColorScale: 1,
  opacity: 0.42,
  metalness: 1,
  roughness: 0.08,
  normalMapStrength: 0.85,
  normalMapScale: 1.5,
  baseNormalMap: DEFAULT_WATER_BASE_NORMAL_MAP,
  normalLayers: 2,
  normalLayerSettings: DEFAULT_WATER_NORMAL_LAYER_SETTINGS,
  edgeRipples: DEFAULT_WATER_EDGE_RIPPLES,
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

/** Cap vertex count — water shader is heavy per-vertex. */
export const WATER_MESH_SEGMENTS_CAP = 224

export function waterMeshSegments(quality: WaterMeshQuality): number {
  const raw = WATER_MESH_QUALITY_OPTIONS.find((option) => option.id === quality)?.segments ?? 96
  return Math.min(raw, WATER_MESH_SEGMENTS_CAP)
}

const WATER_DEFAULTS_STORAGE_KEY = 'manoel-water-defaults-v1'

/** Built-in defaults, optionally overridden by admin “Save as defaults”. */
export function getDefaultWaterSettings(): WaterSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_WATER_SETTINGS
  try {
    const raw = localStorage.getItem(WATER_DEFAULTS_STORAGE_KEY)
    if (!raw) return DEFAULT_WATER_SETTINGS
    return normalizeWaterSettings(JSON.parse(raw) as Partial<WaterSettings>)
  } catch {
    return DEFAULT_WATER_SETTINGS
  }
}

export function saveWaterSettingsAsDefaults(water: WaterSettings): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(WATER_DEFAULTS_STORAGE_KEY, JSON.stringify(normalizeWaterSettings(water)))
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function normalizeDetailLayers(value: number | undefined): WaterSettings['detailLayers'] {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value
  return 0
}

function normalizeNormalLayers(value: number | undefined): WaterSettings['normalLayers'] {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value
  return 0
}

function normalizeNormalLayerSettings(
  value: Partial<WaterSettings> | null | undefined,
): WaterSettings['normalLayerSettings'] {
  const defaults = DEFAULT_WATER_NORMAL_LAYER_SETTINGS
  const source = value?.normalLayerSettings
  const legacy = value as (Partial<WaterSettings> & {
    normalMapWaveScale?: number
    normalMapRandomness?: number
    normalMapSpeed?: number
  }) | null | undefined

  const legacyLayer: WaterNormalLayerSettings = {
    waveScale: clamp(
      legacy?.normalMapWaveScale ?? defaults[0].waveScale,
      WATER_NORMAL_MAP_WAVE_SCALE_MIN,
      WATER_NORMAL_MAP_WAVE_SCALE_MAX,
      defaults[0].waveScale,
    ),
    stretchX: defaults[0].stretchX,
    stretchZ: defaults[0].stretchZ,
    randomness: clamp(legacy?.normalMapRandomness ?? defaults[0].randomness, 0, 1, defaults[0].randomness),
    speed: clamp(legacy?.normalMapSpeed ?? defaults[0].speed, 0, WATER_NORMAL_MAP_SPEED_MAX, defaults[0].speed),
    strength: defaults[0].strength,
    distortion: defaults[0].distortion,
    distortionSpeed: defaults[0].distortionSpeed,
  }

  const normalizeOne = (
    layer: Partial<WaterNormalLayerSettings> | undefined,
    fallback: WaterNormalLayerSettings,
    index: number,
  ): WaterNormalLayerSettings => ({
    waveScale: clamp(
      layer?.waveScale ?? (index === 0 && !source ? legacyLayer.waveScale : fallback.waveScale),
      WATER_NORMAL_MAP_WAVE_SCALE_MIN,
      WATER_NORMAL_MAP_WAVE_SCALE_MAX,
      fallback.waveScale,
    ),
    randomness: clamp(
      layer?.randomness ?? (index === 0 && !source ? legacyLayer.randomness : fallback.randomness),
      0,
      1,
      fallback.randomness,
    ),
    speed: clamp(
      layer?.speed ?? (index === 0 && !source ? legacyLayer.speed : fallback.speed),
      0,
      WATER_NORMAL_MAP_SPEED_MAX,
      fallback.speed,
    ),
    strength: clamp(layer?.strength ?? fallback.strength, 0, WATER_NORMAL_LAYER_STRENGTH_MAX, fallback.strength),
    stretchX: clamp(
      layer?.stretchX ?? fallback.stretchX,
      WATER_NORMAL_LAYER_STRETCH_MIN,
      WATER_NORMAL_LAYER_STRETCH_MAX,
      fallback.stretchX,
    ),
    stretchZ: clamp(
      layer?.stretchZ ?? fallback.stretchZ,
      WATER_NORMAL_LAYER_STRETCH_MIN,
      WATER_NORMAL_LAYER_STRETCH_MAX,
      fallback.stretchZ,
    ),
    distortion: clamp(layer?.distortion ?? fallback.distortion, 0, WATER_DISTORTION_MAX, fallback.distortion),
    distortionSpeed: clamp(
      layer?.distortionSpeed ?? fallback.distortionSpeed,
      0,
      WATER_DISTORTION_SPEED_MAX,
      fallback.distortionSpeed,
    ),
  })

  return [
    normalizeOne(source?.[0], defaults[0], 0),
    normalizeOne(source?.[1], defaults[1], 1),
    normalizeOne(source?.[2], defaults[2], 2),
    normalizeOne(source?.[3], defaults[3], 3),
  ]
}

function normalizeBaseNormalMap(
  value: Partial<WaterBaseNormalSettings> | null | undefined,
): WaterBaseNormalSettings {
  const defaults = DEFAULT_WATER_BASE_NORMAL_MAP
  const shape = value?.shape && isWaterStyle(value.shape) ? value.shape : defaults.shape
  return {
    waveScale: clamp(
      value?.waveScale ?? defaults.waveScale,
      WATER_NORMAL_MAP_WAVE_SCALE_MIN,
      WATER_NORMAL_MAP_WAVE_SCALE_MAX,
      defaults.waveScale,
    ),
    stretchX: clamp(
      value?.stretchX ?? defaults.stretchX,
      WATER_NORMAL_LAYER_STRETCH_MIN,
      WATER_NORMAL_LAYER_STRETCH_MAX,
      defaults.stretchX,
    ),
    stretchZ: clamp(
      value?.stretchZ ?? defaults.stretchZ,
      WATER_NORMAL_LAYER_STRETCH_MIN,
      WATER_NORMAL_LAYER_STRETCH_MAX,
      defaults.stretchZ,
    ),
    randomness: clamp(value?.randomness ?? defaults.randomness, 0, 1, defaults.randomness),
    speed: clamp(value?.speed ?? defaults.speed, 0, WATER_NORMAL_MAP_SPEED_MAX, defaults.speed),
    strength: clamp(
      value?.strength ?? defaults.strength,
      0,
      WATER_NORMAL_LAYER_STRENGTH_MAX,
      defaults.strength,
    ),
    shape,
    distortion: clamp(value?.distortion ?? defaults.distortion, 0, WATER_DISTORTION_MAX, defaults.distortion),
    distortionSpeed: clamp(
      value?.distortionSpeed ?? defaults.distortionSpeed,
      0,
      WATER_DISTORTION_SPEED_MAX,
      defaults.distortionSpeed,
    ),
  }
}

export function packBaseNormalUniforms(water: WaterSettings) {
  const base = water.baseNormalMap
  return {
    uBaseNormalWaveScale: base.waveScale,
    uBaseNormalStretchX: base.stretchX,
    uBaseNormalStretchZ: base.stretchZ,
    uBaseNormalRandomness: base.randomness,
    uBaseNormalSpeed: base.speed,
    uBaseNormalStrength: base.strength,
    uBaseNormalStyle: waterStyleIndex(base.shape),
    uBaseNormalDistortion: base.distortion,
    uBaseNormalDistortionSpeed: base.distortionSpeed,
  }
}

export function packNormalLayerUniforms(water: WaterSettings) {
  const layers = water.normalLayerSettings
  return {
    uNormalLayerCount: water.normalLayers,
    uNormalLayerWaveScale: layers.map((layer) => layer.waveScale),
    uNormalLayerStretchX: layers.map((layer) => layer.stretchX),
    uNormalLayerStretchZ: layers.map((layer) => layer.stretchZ),
    uNormalLayerRandomness: layers.map((layer) => layer.randomness),
    uNormalLayerSpeed: layers.map((layer) => layer.speed),
    uNormalLayerStrength: layers.map((layer) => layer.strength),
    uNormalLayerDistortion: layers.map((layer) => layer.distortion),
    uNormalLayerDistortionSpeed: layers.map((layer) => layer.distortionSpeed),
  }
}

export function packEdgeRippleUniforms(water: WaterSettings) {
  const edge = water.edgeRipples
  return {
    uEdgeRippleEnabled: edge.enabled ? 1 : 0,
    uEdgeRippleStrength: edge.strength,
    uEdgeRippleSpeed: edge.speed,
    uEdgeRippleWaveScale: edge.waveScale,
    uEdgeRippleFalloff: edge.falloff,
    uEdgeRippleMaxDist: edge.maxDistance,
    uEdgeRippleDisplacement: edge.displacementStrength,
    uEdgeRippleNormal: edge.normalStrength,
    uEdgeRippleSoftness: edge.softness,
  }
}

function normalizeEdgeRipples(
  value: Partial<WaterEdgeRippleSettings> | null | undefined,
): WaterEdgeRippleSettings {
  const defaults = DEFAULT_WATER_EDGE_RIPPLES
  return {
    enabled: value?.enabled ?? defaults.enabled,
    strength: clamp(
      value?.strength ?? defaults.strength,
      0,
      WATER_EDGE_RIPPLE_STRENGTH_MAX,
      defaults.strength,
    ),
    speed: clamp(value?.speed ?? defaults.speed, 0, WATER_EDGE_RIPPLE_SPEED_MAX, defaults.speed),
    waveScale: clamp(
      value?.waveScale ?? defaults.waveScale,
      WATER_EDGE_RIPPLE_WAVE_SCALE_MIN,
      WATER_EDGE_RIPPLE_WAVE_SCALE_MAX,
      defaults.waveScale,
    ),
    falloff: clamp(
      value?.falloff ?? defaults.falloff,
      0,
      WATER_EDGE_RIPPLE_FALLOFF_MAX,
      defaults.falloff,
    ),
    maxDistance: clamp(
      value?.maxDistance ?? defaults.maxDistance,
      1,
      WATER_EDGE_RIPPLE_MAX_DISTANCE_MAX,
      defaults.maxDistance,
    ),
    displacementStrength: clamp(
      value?.displacementStrength ?? defaults.displacementStrength,
      0,
      1,
      defaults.displacementStrength,
    ),
    normalStrength: clamp(
      value?.normalStrength ?? defaults.normalStrength,
      0,
      1,
      defaults.normalStrength,
    ),
    softness: clamp(
      value?.softness ?? defaults.softness,
      0,
      WATER_EDGE_RIPPLE_SOFTNESS_MAX,
      defaults.softness,
    ),
  }
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
      50,
      2000,
      DEFAULT_WATER_SETTINGS.planeSize,
    ),
    edgeFade: clamp(value?.edgeFade ?? DEFAULT_WATER_SETTINGS.edgeFade, 0, 1, DEFAULT_WATER_SETTINGS.edgeFade),
    shorelineFadeDistance: clamp(
      value?.shorelineFadeDistance ?? DEFAULT_WATER_SETTINGS.shorelineFadeDistance,
      0,
      WATER_SHORELINE_FADE_DISTANCE_MAX,
      DEFAULT_WATER_SETTINGS.shorelineFadeDistance,
    ),
    shorelineFadeStrength: clamp(
      value?.shorelineFadeStrength ?? DEFAULT_WATER_SETTINGS.shorelineFadeStrength,
      0,
      1,
      DEFAULT_WATER_SETTINGS.shorelineFadeStrength,
    ),
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
    waveScale: clamp(
      value?.waveScale ?? DEFAULT_WATER_SETTINGS.waveScale,
      WATER_WAVE_SCALE_MIN,
      WATER_WAVE_SCALE_MAX,
      DEFAULT_WATER_SETTINGS.waveScale,
    ),
    detailLayers: normalizeDetailLayers(value?.detailLayers),
    detailScale: clamp(
      value?.detailScale ?? DEFAULT_WATER_SETTINGS.detailScale,
      WATER_DETAIL_SCALE_MIN,
      WATER_DETAIL_SCALE_MAX,
      DEFAULT_WATER_SETTINGS.detailScale,
    ),
    detailStrength: clamp(
      value?.detailStrength ?? DEFAULT_WATER_SETTINGS.detailStrength,
      0,
      1,
      DEFAULT_WATER_SETTINGS.detailStrength,
    ),
    displacementDistortion: clamp(
      value?.displacementDistortion ?? DEFAULT_WATER_SETTINGS.displacementDistortion,
      0,
      WATER_DISTORTION_MAX,
      DEFAULT_WATER_SETTINGS.displacementDistortion,
    ),
    displacementDistortionSpeed: clamp(
      value?.displacementDistortionSpeed ?? DEFAULT_WATER_SETTINGS.displacementDistortionSpeed,
      0,
      WATER_DISTORTION_SPEED_MAX,
      DEFAULT_WATER_SETTINGS.displacementDistortionSpeed,
    ),
    detailDistortion: clamp(
      value?.detailDistortion ?? DEFAULT_WATER_SETTINGS.detailDistortion,
      0,
      WATER_DISTORTION_MAX,
      DEFAULT_WATER_SETTINGS.detailDistortion,
    ),
    detailDistortionSpeed: clamp(
      value?.detailDistortionSpeed ?? DEFAULT_WATER_SETTINGS.detailDistortionSpeed,
      0,
      WATER_DISTORTION_SPEED_MAX,
      DEFAULT_WATER_SETTINGS.detailDistortionSpeed,
    ),
    animationSpeed: clamp(
      value?.animationSpeed ?? DEFAULT_WATER_SETTINGS.animationSpeed,
      0,
      5,
      DEFAULT_WATER_SETTINGS.animationSpeed,
    ),
    style,
    color: value?.color ?? DEFAULT_WATER_SETTINGS.color,
    normalHighlightColor:
      value?.normalHighlightColor ??
      (value as { normalColor?: string } | undefined)?.normalColor ??
      DEFAULT_WATER_SETTINGS.normalHighlightColor,
    normalShadowColor: value?.normalShadowColor ?? DEFAULT_WATER_SETTINGS.normalShadowColor,
    normalColorScale: clamp(
      value?.normalColorScale ?? DEFAULT_WATER_SETTINGS.normalColorScale,
      0,
      WATER_NORMAL_COLOR_SCALE_MAX,
      DEFAULT_WATER_SETTINGS.normalColorScale,
    ),
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
    normalMapStrength: clamp(
      value?.normalMapStrength ?? DEFAULT_WATER_SETTINGS.normalMapStrength,
      0,
      WATER_NORMAL_MAP_STRENGTH_MAX,
      DEFAULT_WATER_SETTINGS.normalMapStrength,
    ),
    normalMapScale: clamp(
      value?.normalMapScale ?? DEFAULT_WATER_SETTINGS.normalMapScale,
      WATER_NORMAL_MAP_SCALE_MIN,
      WATER_NORMAL_MAP_SCALE_MAX,
      DEFAULT_WATER_SETTINGS.normalMapScale,
    ),
    baseNormalMap: normalizeBaseNormalMap(value?.baseNormalMap),
    normalLayers: normalizeNormalLayers(value?.normalLayers ?? DEFAULT_WATER_SETTINGS.normalLayers),
    normalLayerSettings: normalizeNormalLayerSettings(value),
    edgeRipples: normalizeEdgeRipples(value?.edgeRipples),
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
