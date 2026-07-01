import { supabase } from '../lib/supabase'
import type { SculptTool, TerrainSculptStroke } from './terrainSculpt'

export type TerrainSculptStrokeRow = {
  id: string
  user_id: string
  created_at: string
  terrain_key: string
  tool: SculptTool
  center_x: number
  center_z: number
  radius: number
  strength: number
}

export function rowToSculptStroke(row: TerrainSculptStrokeRow): TerrainSculptStroke {
  return {
    id: row.id,
    tool: row.tool,
    centerX: row.center_x,
    centerZ: row.center_z,
    radius: row.radius,
    strength: row.strength,
    terrainKey: row.terrain_key,
    createdAt: row.created_at,
  }
}

export async function fetchTerrainSculptStrokes(
  terrainKey: string,
): Promise<TerrainSculptStroke[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('terrain_sculpt_strokes')
    .select('id, user_id, created_at, terrain_key, tool, center_x, center_z, radius, strength')
    .eq('terrain_key', terrainKey)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to load terrain sculpt strokes:', error.message)
    return []
  }

  return (data as TerrainSculptStrokeRow[]).map(rowToSculptStroke)
}

export async function recordTerrainSculptStroke(
  stroke: Omit<TerrainSculptStroke, 'id' | 'createdAt'>,
): Promise<{ ok: true; stroke: TerrainSculptStroke } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const { data, error } = await supabase.rpc('apply_terrain_sculpt_stroke', {
    p_terrain_key: stroke.terrainKey,
    p_tool: stroke.tool,
    p_center_x: stroke.centerX,
    p_center_z: stroke.centerZ,
    p_radius: stroke.radius,
    p_strength: stroke.strength,
  })

  if (error) {
    return { ok: false, message: error.message }
  }

  const row = data as TerrainSculptStrokeRow | null
  if (!row?.id) {
    return { ok: false, message: 'Terrain sculpt was rejected by the server.' }
  }

  return { ok: true, stroke: rowToSculptStroke(row) }
}

export async function fetchTerrainSculptCooldownSeconds(): Promise<number> {
  if (!supabase) return 0

  const { data, error } = await supabase.rpc('get_terrain_sculpt_cooldown_seconds')
  if (error) return 0
  return typeof data === 'number' ? Math.max(0, data) : 0
}

export async function resetTerrainSculptStrokesOnServer(
  terrainKey: string,
  adminPassword: string,
): Promise<{ ok: true; deletedCount: number } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const { data, error } = await supabase.rpc('reset_terrain_sculpt_strokes', {
    p_terrain_key: terrainKey,
    p_admin_password: adminPassword,
  })

  if (error) return { ok: false, message: error.message }
  return { ok: true, deletedCount: typeof data === 'number' ? data : 0 }
}
