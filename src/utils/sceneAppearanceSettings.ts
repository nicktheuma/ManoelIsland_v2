import { DEFAULT_SCENE_APPEARANCE, normalizeSceneAppearance } from '../config/sceneAppearance'
import { supabase } from '../lib/supabase'
import type { SceneAppearance, SandboxSettings } from '../types/sandbox'

export type SceneAppearanceRow = SceneAppearance

export function mergeSceneAppearanceFromRow(
  settings: SandboxSettings,
  appearance: Partial<SceneAppearance> | null | undefined,
): SandboxSettings {
  if (!appearance) return settings

  return {
    ...settings,
    sceneAppearance: normalizeSceneAppearance({
      ...settings.sceneAppearance,
      ...appearance,
    }),
  }
}

export async function syncSceneAppearanceToRemote(
  sceneAppearance: SceneAppearance,
  adminPassword: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const { data, error } = await supabase.rpc('update_scene_appearance', {
    p_admin_password: adminPassword,
    p_scene_appearance: sceneAppearance,
  })

  if (error) return { ok: false, message: error.message }
  if (data !== true) return { ok: false, message: 'Admin authorization failed.' }

  return { ok: true }
}

export function sceneAppearanceFromRow(
  row: { scene_appearance?: Partial<SceneAppearance> | null } | null,
): SceneAppearance {
  if (!row?.scene_appearance) return DEFAULT_SCENE_APPEARANCE
  return normalizeSceneAppearance(row.scene_appearance)
}
