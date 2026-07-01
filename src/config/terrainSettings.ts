import type { LatLng, TerrainSettings, TerrainSampleSize, TerrainSurfaceSampleSize, TerrainSurfaceStyle } from '../types/sandbox'
import { terrainExtentsMeters } from '../utils/terrainElevation'
import {
  DEFAULT_TERRAIN_LAYER_NUDGE,
  DEFAULT_TERRAIN_WATER_LAYER_NUDGE,
  normalizeTerrainLayerNudge,
  normalizeTerrainWaterLayerNudge,
} from '../utils/terrainLayerNudge'

/** Approximate Manoel Island outline (lat, lng) from OpenStreetMap. */
export const MANOEL_ISLAND_POLYGON: LatLng[] = [
  [35.9018, 14.4998],
  [35.9024, 14.5038],
  [35.9048, 14.5060],
  [35.9068, 14.5052],
  [35.9072, 14.5028],
  [35.9064, 14.5000],
  [35.9044, 14.4986],
  [35.9026, 14.4984],
]

export const DEFAULT_TERRAIN_SETTINGS: TerrainSettings = {
  originLat: 35.904,
  originLng: 14.502,
  spanLat: 0.012,
  spanLng: 0.012,
  source: 'dem',
  polygon: MANOEL_ISLAND_POLYGON,
  sampleSize: 192,
  meshQuality: 'high',
  surfaceSampleSize: 256,
  maxHeight: 1,
  version: 1,
  lastMinElevation: null,
  lastMaxElevation: null,
  lastZoom: null,
  surfaceStyle: 'grid',
  surfaceVersion: 0,
  surfaceOpacity: 1,
  showGridOverlay: false,
  lastSurfaceZoom: null,
  osmFeaturesEnabled: false,
  osmFeaturesVersion: 0,
  surroundEnabled: true,
  surroundScale: 2.4,
  surroundOpacity: 0.72,
  surroundDetail: 'low',
  surroundVersion: 0,
  sculptVersion: 0,
  layerNudges: {
    heightmap: { ...DEFAULT_TERRAIN_LAYER_NUDGE },
    surface: { ...DEFAULT_TERRAIN_LAYER_NUDGE },
    osm: { ...DEFAULT_TERRAIN_LAYER_NUDGE },
    water: { ...DEFAULT_TERRAIN_WATER_LAYER_NUDGE },
    surround: { ...DEFAULT_TERRAIN_LAYER_NUDGE },
  },
}

export const TERRAIN_SURFACE_STYLE_OPTIONS: { id: TerrainSettings['surfaceStyle']; label: string }[] = [
  { id: 'grid', label: 'Grid (default)' },
  { id: 'orthophoto', label: 'Orthophoto (satellite)' },
  { id: 'simplified', label: 'Simplified site map' },
]

export const TERRAIN_SAMPLE_SIZE_OPTIONS = [64, 96, 128, 192, 256] as const satisfies readonly TerrainSampleSize[]

export const TERRAIN_SURFACE_SAMPLE_SIZE_OPTIONS = [128, 192, 256, 512] as const satisfies readonly TerrainSurfaceSampleSize[]

export const TERRAIN_MESH_QUALITY_OPTIONS = [
  { id: 'low' as const, label: 'Low (128 segments)' },
  { id: 'medium' as const, label: 'Medium (192 segments)' },
  { id: 'high' as const, label: 'High (256 segments)' },
  { id: 'ultra' as const, label: 'Ultra (320 segments)' },
]

export function normalizeTerrainSettings(value: Partial<TerrainSettings> | null | undefined): TerrainSettings {
  const polygon =
    value?.polygon && value.polygon.length >= 3
      ? value.polygon.map(([lat, lng]) => [lat, lng] as LatLng)
      : DEFAULT_TERRAIN_SETTINGS.polygon

  const sampleSize = TERRAIN_SAMPLE_SIZE_OPTIONS.includes(
    value?.sampleSize as TerrainSampleSize,
  )
    ? (value!.sampleSize as TerrainSampleSize)
    : DEFAULT_TERRAIN_SETTINGS.sampleSize

  const surfaceSampleSize = TERRAIN_SURFACE_SAMPLE_SIZE_OPTIONS.includes(
    value?.surfaceSampleSize as TerrainSurfaceSampleSize,
  )
    ? (value!.surfaceSampleSize as TerrainSurfaceSampleSize)
    : DEFAULT_TERRAIN_SETTINGS.surfaceSampleSize

  const meshQuality =
    value?.meshQuality === 'low' ||
    value?.meshQuality === 'medium' ||
    value?.meshQuality === 'high' ||
    value?.meshQuality === 'ultra'
      ? value.meshQuality
      : DEFAULT_TERRAIN_SETTINGS.meshQuality

  return {
    originLat: clampGeo(value?.originLat ?? DEFAULT_TERRAIN_SETTINGS.originLat, DEFAULT_TERRAIN_SETTINGS.originLat),
    originLng: clampGeo(value?.originLng ?? DEFAULT_TERRAIN_SETTINGS.originLng, DEFAULT_TERRAIN_SETTINGS.originLng),
    spanLat: clamp(value?.spanLat ?? DEFAULT_TERRAIN_SETTINGS.spanLat, 0.001, 0.5, DEFAULT_TERRAIN_SETTINGS.spanLat),
    spanLng: clamp(value?.spanLng ?? DEFAULT_TERRAIN_SETTINGS.spanLng, 0.001, 0.5, DEFAULT_TERRAIN_SETTINGS.spanLng),
    source: value?.source === 'procedural' ? 'procedural' : 'dem',
    polygon,
    sampleSize,
    meshQuality,
    surfaceSampleSize,
    maxHeight: clamp(value?.maxHeight ?? DEFAULT_TERRAIN_SETTINGS.maxHeight, 0.25, 5, DEFAULT_TERRAIN_SETTINGS.maxHeight),
    version: Math.max(1, Math.round(value?.version ?? DEFAULT_TERRAIN_SETTINGS.version)),
    lastMinElevation: value?.lastMinElevation ?? null,
    lastMaxElevation: value?.lastMaxElevation ?? null,
    lastZoom: value?.lastZoom ?? null,
    surfaceStyle: normalizeSurfaceStyle(value?.surfaceStyle),
    surfaceVersion: Math.max(0, Math.round(value?.surfaceVersion ?? DEFAULT_TERRAIN_SETTINGS.surfaceVersion)),
    surfaceOpacity: clamp(value?.surfaceOpacity ?? DEFAULT_TERRAIN_SETTINGS.surfaceOpacity, 0.2, 1, DEFAULT_TERRAIN_SETTINGS.surfaceOpacity),
    showGridOverlay: value?.showGridOverlay ?? DEFAULT_TERRAIN_SETTINGS.showGridOverlay,
    lastSurfaceZoom: value?.lastSurfaceZoom ?? null,
    osmFeaturesEnabled: value?.osmFeaturesEnabled ?? DEFAULT_TERRAIN_SETTINGS.osmFeaturesEnabled,
    osmFeaturesVersion: Math.max(0, Math.round(value?.osmFeaturesVersion ?? DEFAULT_TERRAIN_SETTINGS.osmFeaturesVersion)),
    surroundEnabled: value?.surroundEnabled ?? DEFAULT_TERRAIN_SETTINGS.surroundEnabled,
    surroundScale: clamp(value?.surroundScale ?? DEFAULT_TERRAIN_SETTINGS.surroundScale, 1.6, 4, DEFAULT_TERRAIN_SETTINGS.surroundScale),
    surroundOpacity: clamp(value?.surroundOpacity ?? DEFAULT_TERRAIN_SETTINGS.surroundOpacity, 0.2, 1, DEFAULT_TERRAIN_SETTINGS.surroundOpacity),
    surroundDetail:
      value?.surroundDetail === 'medium' ? 'medium' : DEFAULT_TERRAIN_SETTINGS.surroundDetail,
    surroundVersion: Math.max(0, Math.round(value?.surroundVersion ?? DEFAULT_TERRAIN_SETTINGS.surroundVersion)),
    sculptVersion: Math.max(0, Math.round(value?.sculptVersion ?? DEFAULT_TERRAIN_SETTINGS.sculptVersion)),
    layerNudges: {
      heightmap: normalizeTerrainLayerNudge({
        ...DEFAULT_TERRAIN_SETTINGS.layerNudges.heightmap,
        ...value?.layerNudges?.heightmap,
      }),
      surface: normalizeTerrainLayerNudge({
        ...DEFAULT_TERRAIN_SETTINGS.layerNudges.surface,
        ...value?.layerNudges?.surface,
      }),
      osm: normalizeTerrainLayerNudge({
        ...DEFAULT_TERRAIN_SETTINGS.layerNudges.osm,
        ...value?.layerNudges?.osm,
      }),
      water: normalizeTerrainWaterLayerNudge({
        ...DEFAULT_TERRAIN_SETTINGS.layerNudges.water,
        ...value?.layerNudges?.water,
      }),
      surround: normalizeTerrainLayerNudge({
        ...DEFAULT_TERRAIN_SETTINGS.layerNudges.surround,
        ...value?.layerNudges?.surround,
      }),
    },
  }
}

function normalizeSurfaceStyle(value: unknown): TerrainSurfaceStyle {
  if (value === 'orthophoto' || value === 'simplified' || value === 'grid') return value
  return DEFAULT_TERRAIN_SETTINGS.surfaceStyle
}

function clampGeo(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return value
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

const CACHE_PREFIX = 'manoel-dem-heightmap-'
const SURFACE_CACHE_PREFIX = 'manoel-terrain-surface-'

export function terrainCacheKey(settings: TerrainSettings): string {
  return `${CACHE_PREFIX}${settings.version}-${settings.sculptVersion}-${settings.sampleSize}-${settings.originLat.toFixed(5)}-${settings.originLng.toFixed(5)}-${settings.spanLat.toFixed(5)}-${settings.spanLng.toFixed(5)}`
}

export function loadCachedHeightmapUrl(settings: TerrainSettings): string | null {
  try {
    return localStorage.getItem(terrainCacheKey(settings))
  } catch {
    return null
  }
}

export function saveCachedHeightmapUrl(settings: TerrainSettings, objectUrl: string): void {
  try {
    localStorage.setItem(terrainCacheKey(settings), objectUrl)
  } catch {
    // Ignore quota errors; runtime generation still works this session.
  }
}

export function clearCachedHeightmaps(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(CACHE_PREFIX) || key?.startsWith(SURFACE_CACHE_PREFIX) || key?.startsWith(OSM_FEATURES_CACHE_PREFIX)) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // ignore
  }
}

const OSM_FEATURES_CACHE_PREFIX = 'manoel-osm-features-'

export function osmFeaturesCacheKey(settings: TerrainSettings): string {
  const { widthMeters, depthMeters } = terrainExtentsMeters(settings)
  return `${OSM_FEATURES_CACHE_PREFIX}${settings.osmFeaturesVersion}-${settings.originLat.toFixed(5)}-${settings.originLng.toFixed(5)}-${settings.spanLat.toFixed(5)}-${settings.spanLng.toFixed(5)}-${widthMeters.toFixed(1)}-${depthMeters.toFixed(1)}`
}

export function loadCachedOsmFeatures(settings: TerrainSettings): string | null {
  if (settings.osmFeaturesVersion < 1) return null
  try {
    return localStorage.getItem(osmFeaturesCacheKey(settings))
  } catch {
    return null
  }
}

export function saveCachedOsmFeatures(settings: TerrainSettings, json: string): void {
  try {
    localStorage.setItem(osmFeaturesCacheKey(settings), json)
  } catch {
    // ignore quota errors
  }
}

export function terrainSurfaceCacheKey(settings: TerrainSettings): string {
  return `${SURFACE_CACHE_PREFIX}${settings.surfaceStyle}-${settings.surfaceVersion}-${settings.surfaceSampleSize}-${settings.originLat.toFixed(5)}-${settings.originLng.toFixed(5)}-${settings.spanLat.toFixed(5)}-${settings.spanLng.toFixed(5)}`
}

export function loadCachedSurfaceUrl(settings: TerrainSettings): string | null {
  if (settings.surfaceStyle === 'grid' || settings.surfaceVersion < 1) return null
  try {
    return localStorage.getItem(terrainSurfaceCacheKey(settings))
  } catch {
    return null
  }
}

export function saveCachedSurfaceUrl(settings: TerrainSettings, objectUrl: string): void {
  if (settings.surfaceStyle === 'grid') return
  try {
    localStorage.setItem(terrainSurfaceCacheKey(settings), objectUrl)
  } catch {
    // ignore quota errors
  }
}
