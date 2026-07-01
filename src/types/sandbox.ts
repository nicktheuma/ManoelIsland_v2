import type { PropCategory, PropDefinition } from './propLibrary'

export type AllowedZone = {
  id: string
  name: string
  points: [number, number][]
  color: string
}

export type PropRateLimit = {
  enabled: boolean
  maxPlacements: number
  windowMinutes: number
}

export type RateLimitSettings = {
  enabled: boolean
  maxPlacements: number
  windowMinutes: number
  perProp: Record<string, PropRateLimit>
}

export type PlacementRules = {
  snapGridEnabled: boolean
  snapGridSize: number
  zonesEnabled: boolean
  maxPropsPerCell: number
  densityCellSize: number
  densityEnabled: boolean
}

export type UserVisibility = {
  showPropToolbar: boolean
  showPlacementHints: boolean
  showZoneOverlays: boolean
  showSnapGrid: boolean
  showUndoRedo: boolean
}

export type HdriPresetId =
  | 'none'
  | 'apartment'
  | 'city'
  | 'dawn'
  | 'forest'
  | 'lobby'
  | 'night'
  | 'park'
  | 'studio'
  | 'sunset'
  | 'warehouse'

export type WaterStyleId = 'calm' | 'choppy' | 'ripples'

export type WaterMeshQuality = 'low' | 'medium' | 'high'

export type WaterSettings = {
  enabled: boolean
  level: number
  planeSize: number
  edgeFade: number
  meshQuality: WaterMeshQuality
  waveHeight: number
  waveIntensity: number
  waveRandomness: number
  waveSeed: number
  detailLayers: 0 | 1 | 2
  detailScale: number
  detailStrength: number
  animationSpeed: number
  style: WaterStyleId
  color: string
  opacity: number
  metalness: number
  roughness: number
}

export type FogSettings = {
  enabled: boolean
  color: string
  near: number
  far: number
  matchBackground: boolean
}

export type LatLng = [number, number]

export type TerrainSurfaceStyle = 'grid' | 'orthophoto' | 'simplified'

export type TerrainSettings = {
  source: 'procedural' | 'dem'
  polygon: LatLng[]
  sampleSize: 64 | 96 | 128
  maxHeight: number
  version: number
  lastMinElevation: number | null
  lastMaxElevation: number | null
  lastZoom: number | null
  surfaceStyle: TerrainSurfaceStyle
  surfaceVersion: number
  surfaceOpacity: number
  showGridOverlay: boolean
  lastSurfaceZoom: number | null
}

export type SceneAppearance = {
  hdriPreset: HdriPresetId
  backgroundColor: string
  terrainFillColor: string
  terrainFillOpacity: number
  terrainGridColor: string
  terrain: TerrainSettings
  water: WaterSettings
  fog: FogSettings
}

export type SandboxSettings = {
  placementRules: PlacementRules
  rateLimit: RateLimitSettings
  zones: AllowedZone[]
  userVisibility: UserVisibility
  categories: PropCategory[]
  propLibrary: PropDefinition[]
  sceneAppearance: SceneAppearance
}

export type PlacementValidation = {
  ok: boolean
  reason?: string
}
