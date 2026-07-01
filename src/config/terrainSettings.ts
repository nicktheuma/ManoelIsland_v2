import type { LatLng, TerrainSettings, TerrainSurfaceStyle } from '../types/sandbox'

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
  source: 'dem',
  polygon: MANOEL_ISLAND_POLYGON,
  sampleSize: 128,
  maxHeight: 8,
  version: 1,
  lastMinElevation: null,
  lastMaxElevation: null,
  lastZoom: null,
  surfaceStyle: 'grid',
  surfaceVersion: 0,
  surfaceOpacity: 1,
  showGridOverlay: false,
  lastSurfaceZoom: null,
}

export const TERRAIN_SURFACE_STYLE_OPTIONS: { id: TerrainSettings['surfaceStyle']; label: string }[] = [
  { id: 'grid', label: 'Grid (default)' },
  { id: 'orthophoto', label: 'Orthophoto (satellite)' },
  { id: 'simplified', label: 'Simplified site map' },
]

export const TERRAIN_SAMPLE_SIZE_OPTIONS = [64, 96, 128] as const

export function normalizeTerrainSettings(value: Partial<TerrainSettings> | null | undefined): TerrainSettings {
  const polygon =
    value?.polygon && value.polygon.length >= 3
      ? value.polygon.map(([lat, lng]) => [lat, lng] as LatLng)
      : DEFAULT_TERRAIN_SETTINGS.polygon

  const sampleSize = TERRAIN_SAMPLE_SIZE_OPTIONS.includes(
    value?.sampleSize as (typeof TERRAIN_SAMPLE_SIZE_OPTIONS)[number],
  )
    ? (value!.sampleSize as (typeof TERRAIN_SAMPLE_SIZE_OPTIONS)[number])
    : DEFAULT_TERRAIN_SETTINGS.sampleSize

  return {
    source: value?.source === 'procedural' ? 'procedural' : 'dem',
    polygon,
    sampleSize,
    maxHeight: clamp(value?.maxHeight ?? DEFAULT_TERRAIN_SETTINGS.maxHeight, 1, 30, DEFAULT_TERRAIN_SETTINGS.maxHeight),
    version: Math.max(1, Math.round(value?.version ?? DEFAULT_TERRAIN_SETTINGS.version)),
    lastMinElevation: value?.lastMinElevation ?? null,
    lastMaxElevation: value?.lastMaxElevation ?? null,
    lastZoom: value?.lastZoom ?? null,
    surfaceStyle: normalizeSurfaceStyle(value?.surfaceStyle),
    surfaceVersion: Math.max(0, Math.round(value?.surfaceVersion ?? DEFAULT_TERRAIN_SETTINGS.surfaceVersion)),
    surfaceOpacity: clamp(value?.surfaceOpacity ?? DEFAULT_TERRAIN_SETTINGS.surfaceOpacity, 0.2, 1, DEFAULT_TERRAIN_SETTINGS.surfaceOpacity),
    showGridOverlay: value?.showGridOverlay ?? DEFAULT_TERRAIN_SETTINGS.showGridOverlay,
    lastSurfaceZoom: value?.lastSurfaceZoom ?? null,
  }
}

function normalizeSurfaceStyle(value: unknown): TerrainSurfaceStyle {
  if (value === 'orthophoto' || value === 'simplified' || value === 'grid') return value
  return DEFAULT_TERRAIN_SETTINGS.surfaceStyle
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

const CACHE_PREFIX = 'manoel-dem-heightmap-'
const SURFACE_CACHE_PREFIX = 'manoel-terrain-surface-'

export function terrainCacheKey(settings: TerrainSettings): string {
  return `${CACHE_PREFIX}${settings.version}-${settings.sampleSize}`
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
      if (key?.startsWith(CACHE_PREFIX) || key?.startsWith(SURFACE_CACHE_PREFIX)) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // ignore
  }
}

export function terrainSurfaceCacheKey(settings: TerrainSettings): string {
  return `${SURFACE_CACHE_PREFIX}${settings.surfaceStyle}-${settings.surfaceVersion}-${settings.sampleSize}`
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
