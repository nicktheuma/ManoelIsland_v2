import { supabase } from '../lib/supabase'

export async function wipeMapClutter(): Promise<
  { ok: true; deletedCount: number } | { ok: false; message: string }
> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const { data, error } = await supabase.rpc('wipe_map_clutter')
  if (error) return { ok: false, message: error.message }

  return { ok: true, deletedCount: typeof data === 'number' ? data : 0 }
}

export async function setLayoutLocked(
  locked: boolean,
): Promise<{ ok: true; updatedCount: number } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const { data, error } = await supabase.rpc('set_layout_locked', { p_locked: locked })
  if (error) return { ok: false, message: error.message }

  return { ok: true, updatedCount: typeof data === 'number' ? data : 0 }
}
