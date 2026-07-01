import { supabase } from '../lib/supabase'
import { registerAdminSession } from './rateLimitSettings'

export async function wipeMapClutter(): Promise<
  { ok: true; deletedCount: number } | { ok: false; message: string }
> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const { data, error } = await supabase.rpc('wipe_map_clutter')
  if (error) return { ok: false, message: error.message }

  return { ok: true, deletedCount: typeof data === 'number' ? data : 0 }
}

function isMissingRpcError(message: string, functionName: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes(functionName.toLowerCase()) ||
    lower.includes('schema cache') ||
    lower.includes('could not find the function')
  )
}

function isUnauthorizedError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('unauthorized') || lower.includes('permission denied')
}

async function deleteAllPropsViaTable(
  adminPassword: string,
): Promise<{ ok: true; deletedCount: number } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const sessionOk = await registerAdminSession(adminPassword)
  if (!sessionOk) {
    return {
      ok: false,
      message:
        'Admin authorization failed. Use the correct admin password or sign in with your Supabase admin account.',
    }
  }

  const { data: rows, error: selectError } = await supabase.from('placed_props').select('id')
  if (selectError) {
    return {
      ok: false,
      message:
        selectError.message +
        ' Apply supabase/migrations/20250629190000_wipe_all_props.sql in the Supabase SQL editor.',
    }
  }

  const ids = (rows ?? []).map((row) => row.id).filter(Boolean)
  if (ids.length === 0) return { ok: true, deletedCount: 0 }

  let deletedCount = 0
  const batchSize = 100

  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize)
    const { data: deleted, error: deleteError } = await supabase
      .from('placed_props')
      .delete()
      .in('id', batch)
      .select('id')

    if (deleteError) {
      return {
        ok: false,
        message:
          deleteError.message +
          ' Apply supabase/migrations/20250629190000_wipe_all_props.sql for reliable delete-all.',
      }
    }

    deletedCount += deleted?.length ?? 0
  }

  if (deletedCount === 0 && ids.length > 0) {
    return {
      ok: false,
      message:
        'No props were deleted. Sign in with your Supabase admin account or verify VITE_ADMIN_PASSWORD matches the server.',
    }
  }

  return { ok: true, deletedCount }
}

export async function wipeAllProps(
  adminPassword: string,
): Promise<{ ok: true; deletedCount: number } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const { data, error } = await supabase.rpc('wipe_all_props', {
    p_admin_password: adminPassword,
  })

  if (!error) {
    return { ok: true, deletedCount: typeof data === 'number' ? data : 0 }
  }

  if (isUnauthorizedError(error.message)) {
    return {
      ok: false,
      message:
        'Admin authorization failed. Use the correct admin password or sign in with your Supabase admin account.',
    }
  }

  if (isMissingRpcError(error.message, 'wipe_all_props')) {
    return deleteAllPropsViaTable(adminPassword)
  }

  return { ok: false, message: error.message }
}

export async function setLayoutLocked(
  locked: boolean,
): Promise<{ ok: true; updatedCount: number } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const { data, error } = await supabase.rpc('set_layout_locked', { p_locked: locked })
  if (error) return { ok: false, message: error.message }

  return { ok: true, updatedCount: typeof data === 'number' ? data : 0 }
}
