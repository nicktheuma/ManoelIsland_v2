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

export type TerrainSculptRateLimit = {
  enabled: boolean
  maxStrokes: number
  windowMinutes: number
}

export type RateLimitSettings = {
  enabled: boolean
  maxPlacements: number
  windowMinutes: number
  perProp: Record<string, PropRateLimit>
  terrainSculpt: TerrainSculptRateLimit
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
  showSculptTools: boolean
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

export type WaterMeshQuality = 'low' | 'medium' | 'high' | 'ultra' | 'extreme' | 'superior' | 'insane' | 'maximum'

export type WaterBaseNormalSettings = {
  /** Ripple spatial scale (higher = smaller ripples). */
  waveScale: number
  /** Stretch ripples along world X (1 = even). */
  stretchX: number
  /** Stretch ripples along world Z (1 = even). */
  stretchZ: number
  /** Direction, frequency, and phase variation (0–1). */
  randomness: number
  /** Animation speed multiplier for the base normal map. */
  speed: number
  /** Contribution to lighting normals (0–1). */
  strength: number
  /** Wave shape preset for displacement-aligned base normals. */
  shape: WaterStyleId
  /** Coordinate warp strength (0 = off). */
  distortion: number
  /** Distortion animation speed multiplier (0 = frozen). */
  distortionSpeed: number
}

export type WaterNormalLayerSettings = {
  /** Ripple spatial scale (higher = smaller ripples). */
  waveScale: number
  /** Stretch ripples along world X (1 = even). */
  stretchX: number
  /** Stretch ripples along world Z (1 = even). */
  stretchZ: number
  /** Direction, frequency, and phase variation (0–1). */
  randomness: number
  /** Animation speed multiplier for this layer. */
  speed: number
  /** Contribution to lighting normals (0–1). */
  strength: number
  /** Coordinate warp strength (0 = off). */
  distortion: number
  /** Distortion animation speed multiplier (0 = frozen). */
  distortionSpeed: number
}

export type WaterEdgeRippleSettings = {
  enabled: boolean
  /** Overall ripple amplitude (0–1). */
  strength: number
  /** Outward propagation speed multiplier. */
  speed: number
  /** Spatial frequency along distance from shore (higher = tighter rings). */
  waveScale: number
  /** Exponential decay with distance from the terrain edge. */
  falloff: number
  /** Only show ripples within this distance from the cropped terrain edge (metres). */
  maxDistance: number
  /** Height displacement contribution (0–1). */
  displacementStrength: number
  /** Lighting normal contribution (0–1). */
  normalStrength: number
  /** Soften ring peaks and troughs (0 = sharp sine, 1 = rounded). */
  softness: number
}

export type WaterSettings = {
  enabled: boolean
  level: number
  planeSize: number
  edgeFade: number
  /** Metres from shoreline over which water opacity ramps from 0 → full. 0 = off. */
  shorelineFadeDistance: number
  /** How strongly shoreline fade affects opacity (0 = none, 1 = full). */
  shorelineFadeStrength: number
  meshQuality: WaterMeshQuality
  waveHeight: number
  waveIntensity: number
  waveRandomness: number
  waveSeed: number
  waveScale: number
  detailLayers: 0 | 1 | 2 | 3 | 4
  detailScale: number
  detailStrength: number
  /** Coordinate warp for base displacement waves (0 = off). */
  displacementDistortion: number
  /** Distortion animation speed for base displacement. */
  displacementDistortionSpeed: number
  /** Coordinate warp for detail displacement (0 = off). */
  detailDistortion: number
  /** Distortion animation speed for detail displacement. */
  detailDistortionSpeed: number
  animationSpeed: number
  style: WaterStyleId
  /** Diffuse / body colour of the water. */
  color: string
  /** Specular and sun-facing normal highlight tint. */
  normalHighlightColor: string
  /** Normal tint in troughs and away from the sun. */
  normalShadowColor: string
  /** Intensity of normal-driven colour (0–3). */
  normalColorScale: number
  opacity: number
  metalness: number
  roughness: number
  /** Specular normal-detail strength (0 = flat, 1 = full wave-lit). */
  normalMapStrength: number
  /** Normal sample radius in world metres (softer displacement normals when higher). */
  normalMapScale: number
  /** Base lighting normal map (mesh-aligned swell shape). */
  baseNormalMap: WaterBaseNormalSettings
  /** Number of lighting normal ripple layers (0–4). */
  normalLayers: 0 | 1 | 2 | 3 | 4
  /** Per-layer ripple settings (layers above normalLayers count are ignored). */
  normalLayerSettings: [
    WaterNormalLayerSettings,
    WaterNormalLayerSettings,
    WaterNormalLayerSettings,
    WaterNormalLayerSettings,
  ]
  /** Ripples emanating outward from the cropped terrain polygon edge. */
  edgeRipples: WaterEdgeRippleSettings
}

export type FogSettings = {
  enabled: boolean
  color: string
  near: number
  far: number
  matchBackground: boolean
}

export type LatLng = [number, number]

export type TerrainGeoReference = {
  originLat: number
  originLng: number
  spanLat: number
  spanLng: number
}

export type TerrainSurfaceStyle = 'grid' | 'orthophoto' | 'simplified'

export type TerrainMeshQuality = 'low' | 'medium' | 'high' | 'ultra'

export type TerrainSampleSize = 64 | 96 | 128 | 192 | 256

export type TerrainSurfaceSampleSize = 128 | 192 | 256 | 512

/** Temporary manual nudge for layer alignment (world units). `y` = north–south (world Z). */
export type TerrainLayerNudge = {
  x: number
  y: number
  /** Horizontal scale (1 = 100%). X = east–west, Y = north–south. */
  scaleX: number
  scaleY: number
}

export type TerrainWaterLayerNudge = TerrainLayerNudge & {
  /** Vertical offset from computed sea level (world Y). */
  height: number
}

export type TerrainLayerNudges = {
  heightmap: TerrainLayerNudge
  surface: TerrainLayerNudge
  osm: TerrainLayerNudge
  water: TerrainWaterLayerNudge
  surround: TerrainLayerNudge
}

export type TerrainSettings = TerrainGeoReference & {
  source: 'procedural' | 'dem'
  polygon: LatLng[]
  sampleSize: TerrainSampleSize
  meshQuality: TerrainMeshQuality
  surfaceSampleSize: TerrainSurfaceSampleSize
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
  osmFeaturesEnabled: boolean
  osmFeaturesVersion: number
  surroundEnabled: boolean
  surroundScale: number
  surroundOpacity: number
  surroundDetail: 'low' | 'medium'
  surroundVersion: number
  sculptVersion: number
  layerNudges: TerrainLayerNudges
}

export type CameraSettings = {
  position: [number, number, number]
  target: [number, number, number]
  fov: number
  /** Perspective camera near clip plane (world units). */
  near: number
  /** Perspective camera far clip plane (world units). */
  far: number
  minDistance: number
  maxDistance: number
  maxPolarAngleDeg: number
}

export type CapturedCameraView = Pick<CameraSettings, 'position' | 'target' | 'fov'>

export type SceneAppearance = {
  hdriPreset: HdriPresetId
  backgroundColor: string
  terrainFillColor: string
  terrainFillOpacity: number
  terrainGridColor: string
  terrain: TerrainSettings
  camera: CameraSettings
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
