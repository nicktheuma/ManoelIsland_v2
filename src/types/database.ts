export type PlacedPropRow = {
  id: string
  prop_type: string
  x: number
  y: number
  z: number
  rotation_x: number
  rotation_y: number
  rotation_z: number
  scale: number
  color: string
  metadata: Record<string, unknown>
  is_locked: boolean
  user_id: string
  created_at: string
}

export type PlacedPropInsert = {
  id: string
  prop_type: string
  x: number
  y: number
  z: number
  rotation_x: number
  rotation_y: number
  rotation_z: number
  scale: number
  color: string
  metadata: Record<string, unknown>
  user_id: string
}
