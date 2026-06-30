import type { PlacedPropRow, PlacedPropInsert } from '../types/database'
import type { PlacedProp } from '../types/props'

export function rowToPlacedProp(row: PlacedPropRow): PlacedProp {
  return {
    id: row.id,
    propId: row.prop_type,
    position: [row.x, row.y, row.z],
    rotation: [row.rotation_x, row.rotation_y, row.rotation_z],
    scale: row.scale,
    color: row.color,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    isLocked: row.is_locked,
  }
}

export function placedPropToInsert(prop: PlacedProp, userId: string): PlacedPropInsert {
  return {
    id: prop.id,
    prop_type: prop.propId,
    x: prop.position[0],
    y: prop.position[1],
    z: prop.position[2],
    rotation_x: prop.rotation[0],
    rotation_y: prop.rotation[1],
    rotation_z: prop.rotation[2],
    scale: prop.scale,
    color: prop.color,
    metadata: prop.metadata,
    user_id: userId,
  }
}

export function placedPropPatchToRow(
  patch: Partial<PlacedProp>,
): Partial<Omit<PlacedPropRow, 'id' | 'user_id' | 'created_at' | 'is_locked'>> {
  const row: Partial<Omit<PlacedPropRow, 'id' | 'user_id' | 'created_at' | 'is_locked'>> = {}

  if (patch.propId !== undefined) row.prop_type = patch.propId
  if (patch.position !== undefined) {
    row.x = patch.position[0]
    row.y = patch.position[1]
    row.z = patch.position[2]
  }
  if (patch.rotation !== undefined) {
    row.rotation_x = patch.rotation[0]
    row.rotation_y = patch.rotation[1]
    row.rotation_z = patch.rotation[2]
  }
  if (patch.scale !== undefined) row.scale = patch.scale
  if (patch.color !== undefined) row.color = patch.color
  if (patch.metadata !== undefined) row.metadata = patch.metadata

  return row
}
