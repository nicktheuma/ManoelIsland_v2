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

export type SandboxSettings = {
  placementRules: PlacementRules
  rateLimit: RateLimitSettings
  zones: AllowedZone[]
  userVisibility: UserVisibility
  categories: PropCategory[]
  propLibrary: PropDefinition[]
}

export type PlacementValidation = {
  ok: boolean
  reason?: string
}
