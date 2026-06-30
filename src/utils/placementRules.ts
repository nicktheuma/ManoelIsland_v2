import type { PlacedProp } from '../types/props'
import type { PropDefinition } from '../types/propLibrary'
import type { PlacementValidation, SandboxSettings } from '../types/sandbox'
import {
  countPropsInCell,
  getApplicableZones,
  hasPropOverlap,
  pointInPolygon,
  resolvePlacementPosition,
} from './geometry'

function getPropDefinition(settings: SandboxSettings, propId: string): PropDefinition | undefined {
  return settings.propLibrary.find((prop) => prop.id === propId)
}

function getDensitySettings(
  definition: PropDefinition,
  settings: SandboxSettings,
): { enabled: boolean; maxPropsPerCell: number; densityCellSize: number } {
  if (definition.placement.useCustomDensity) {
    return {
      enabled: true,
      maxPropsPerCell: definition.placement.maxPropsPerCell,
      densityCellSize: definition.placement.densityCellSize,
    }
  }

  return {
    enabled: settings.placementRules.densityEnabled,
    maxPropsPerCell: settings.placementRules.maxPropsPerCell,
    densityCellSize: settings.placementRules.densityCellSize,
  }
}

export function applyPlacementRules(
  position: [number, number, number],
  propId: string,
  propScale: number,
  settings: SandboxSettings,
  placedProps: PlacedProp[],
  getHeightAt?: (x: number, z: number) => number,
  excludePropId?: string,
): { position: [number, number, number]; validation: PlacementValidation } {
  const definition = getPropDefinition(settings, propId)
  if (!definition) {
    return { position, validation: { ok: false, reason: 'Unknown prop type.' } }
  }

  const nextPosition = resolvePlacementPosition(
    position,
    settings.placementRules.snapGridEnabled,
    settings.placementRules.snapGridSize,
    getHeightAt,
  )

  const applicableZones = getApplicableZones(definition, settings.placementRules, settings.zones)
  if (applicableZones.length > 0) {
    const insideAllowedZone = applicableZones.some((zone) =>
      pointInPolygon(nextPosition[0], nextPosition[2], zone.points),
    )
    if (!insideAllowedZone) {
      return {
        position: nextPosition,
        validation: { ok: false, reason: 'Placement must be inside an allowed zone for this prop.' },
      }
    }
  }

  const newRadius = definition.placement.colliderRadius * propScale
  if (hasPropOverlap(nextPosition, newRadius, placedProps, settings.propLibrary, excludePropId)) {
    return {
      position: nextPosition,
      validation: { ok: false, reason: 'Too close to another prop.' },
    }
  }

  const density = getDensitySettings(definition, settings)
  if (density.enabled) {
    const count = countPropsInCell(
      placedProps,
      nextPosition[0],
      nextPosition[2],
      density.densityCellSize,
      propId,
      excludePropId,
    )
    if (count >= density.maxPropsPerCell) {
      return {
        position: nextPosition,
        validation: {
          ok: false,
          reason: `Max ${density.maxPropsPerCell} of this prop type allowed in this area.`,
        },
      }
    }
  }

  return { position: nextPosition, validation: { ok: true } }
}

export function previewPlacementPosition(
  position: [number, number, number],
  settings: SandboxSettings,
  getHeightAt?: (x: number, z: number) => number,
): [number, number, number] {
  return resolvePlacementPosition(
    position,
    settings.placementRules.snapGridEnabled,
    settings.placementRules.snapGridSize,
    getHeightAt,
  )
}

export function getUserPlaceableProps(settings: SandboxSettings) {
  const visibleCategoryIds = new Set(
    settings.categories.filter((category) => category.userVisible).map((category) => category.id),
  )

  return settings.propLibrary.filter(
    (prop) => prop.userPlaceable && visibleCategoryIds.has(prop.categoryId),
  )
}
