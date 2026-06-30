import type { PlacedProp } from '../types/props'
import type { PropDefinition } from '../types/propLibrary'
import type { AllowedZone, PlacementRules } from '../types/sandbox'

export function pointInPolygon(x: number, z: number, polygon: [number, number][]): boolean {
  if (polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i]
    const [xj, zj] = polygon[j]
    const intersects = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi
    if (intersects) inside = !inside
  }

  return inside
}

export function snapAxis(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

export function snapPosition(
  position: [number, number, number],
  gridSize: number,
): [number, number, number] {
  return [snapAxis(position[0], gridSize), position[1], snapAxis(position[2], gridSize)]
}

export function densityCellKey(x: number, z: number, cellSize: number): string {
  return `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`
}

export function countPropsInCell(
  props: PlacedProp[],
  x: number,
  z: number,
  cellSize: number,
  propId?: string,
  excludeId?: string,
): number {
  const key = densityCellKey(x, z, cellSize)
  return props.filter((prop) => {
    if (excludeId && prop.id === excludeId) return false
    if (propId && prop.propId !== propId) return false
    return densityCellKey(prop.position[0], prop.position[2], cellSize) === key
  }).length
}

export function hasPropOverlap(
  position: [number, number, number],
  newRadius: number,
  placedProps: PlacedProp[],
  propLibrary: PropDefinition[],
  excludeId?: string,
): boolean {
  for (const placed of placedProps) {
    if (excludeId && placed.id === excludeId) continue

    const definition = propLibrary.find((prop) => prop.id === placed.propId)
    const otherRadius = (definition?.placement.colliderRadius ?? 1) * placed.scale
    const dx = position[0] - placed.position[0]
    const dz = position[2] - placed.position[2]
    if (Math.hypot(dx, dz) < newRadius + otherRadius) return true
  }

  return false
}

export function getApplicableZones(
  propDefinition: PropDefinition,
  globalRules: PlacementRules,
  zones: AllowedZone[],
): AllowedZone[] {
  if (propDefinition.placement.useCustomZones) {
    if (propDefinition.placement.allowedZoneIds.length === 0) return []
    return zones.filter((zone) => propDefinition.placement.allowedZoneIds.includes(zone.id))
  }

  if (!globalRules.zonesEnabled) return []
  return zones
}

export function resolvePlacementPosition(
  position: [number, number, number],
  snapGridEnabled: boolean,
  snapGridSize: number,
  getHeightAt?: (x: number, z: number) => number,
): [number, number, number] {
  if (!snapGridEnabled) return position

  const [x, , z] = snapPosition(position, snapGridSize)
  const y = getHeightAt ? getHeightAt(x, z) : position[1]
  return [x, y, z]
}
