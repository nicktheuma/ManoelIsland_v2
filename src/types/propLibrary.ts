export type PropVariationConfig = {
  enabled: boolean
  scaleMin: number
  scaleMax: number
  colorMin: string
  colorMax: string
}

export type PropPlacementConfig = {
  colliderRadius: number
  useCustomZones: boolean
  allowedZoneIds: string[]
  useCustomDensity: boolean
  maxPropsPerCell: number
  densityCellSize: number
}

export type PropBehavior = 'static' | 'animated' | 'temporal' | 'agentic'

export type PropGeometry =
  | 'tree'
  | 'bench'
  | 'pavilion'
  | 'box'
  | 'capsule'
  | 'cylinder'
  | 'car'
  | 'person'

export type PropCategory = {
  id: string
  name: string
  description: string
  userVisible: boolean
}

export type PropBehaviorConfig = {
  animationSpeed?: number
  durationDays?: number
  durationWeeks?: number
  agentSpeed?: number
  pathRadius?: number
}

export type PropDefinition = {
  id: string
  name: string
  categoryId: string
  behavior: PropBehavior
  geometry: PropGeometry
  defaultColor: string
  defaultScale: number
  userPlaceable: boolean
  placement: PropPlacementConfig
  variation: PropVariationConfig
  behaviorConfig?: PropBehaviorConfig
}
