import type { PropDefinition, PropPlacementConfig } from '../types/propLibrary'
import { createDefaultVariation } from '../utils/propVariation'

export function createDefaultPlacement(partial?: Partial<PropPlacementConfig>): PropPlacementConfig {
  return {
    colliderRadius: partial?.colliderRadius ?? 1.5,
    useCustomZones: partial?.useCustomZones ?? false,
    allowedZoneIds: partial?.allowedZoneIds ?? [],
    useCustomDensity: partial?.useCustomDensity ?? false,
    maxPropsPerCell: partial?.maxPropsPerCell ?? 3,
    densityCellSize: partial?.densityCellSize ?? 10,
  }
}

export const DEFAULT_PLACEMENT_BY_GEOMETRY: Record<PropDefinition['geometry'], PropPlacementConfig> = {
  tree: createDefaultPlacement({ colliderRadius: 2 }),
  bench: createDefaultPlacement({ colliderRadius: 1.5 }),
  pavilion: createDefaultPlacement({ colliderRadius: 3 }),
  box: createDefaultPlacement({ colliderRadius: 1 }),
  capsule: createDefaultPlacement({ colliderRadius: 1.2 }),
  cylinder: createDefaultPlacement({ colliderRadius: 1 }),
  car: createDefaultPlacement({ colliderRadius: 2.5 }),
  person: createDefaultPlacement({ colliderRadius: 0.6 }),
}

export function withPropDefaults(
  prop: Omit<PropDefinition, 'placement' | 'variation'>,
  placement?: Partial<PropPlacementConfig>,
): PropDefinition {
  return {
    ...prop,
    placement: createDefaultPlacement({
      ...DEFAULT_PLACEMENT_BY_GEOMETRY[prop.geometry],
      ...placement,
    }),
    variation: createDefaultVariation(prop.defaultColor, prop.defaultScale),
  }
}

export function mergePropDefinition(stored: PropDefinition, fallback: PropDefinition): PropDefinition {
  return {
    ...fallback,
    ...stored,
    placement: {
      ...fallback.placement,
      ...stored.placement,
      allowedZoneIds: stored.placement?.allowedZoneIds ?? fallback.placement.allowedZoneIds,
    },
    variation: {
      ...fallback.variation,
      ...(stored.variation ?? {}),
    },
    behaviorConfig: stored.behaviorConfig ?? fallback.behaviorConfig,
  }
}
