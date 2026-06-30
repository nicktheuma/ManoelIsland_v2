import { DEFAULT_RATE_LIMIT } from '../config/defaults'
import { supabase } from '../lib/supabase'
import type { RateLimitSettings, SandboxSettings } from '../types/sandbox'

export type SandboxSettingsRow = {
  rate_limit_enabled: boolean
  max_placements: number
  window_minutes: number
  per_prop_limits: Record<string, RateLimitSettings['perProp'][string]>
  layout_locked: boolean
}

export function rateLimitFromSettings(settings: SandboxSettings): RateLimitSettings {
  return {
    ...DEFAULT_RATE_LIMIT,
    ...settings.rateLimit,
    perProp: { ...DEFAULT_RATE_LIMIT.perProp, ...settings.rateLimit?.perProp },
  }
}

export function mergeRateLimitFromRow(
  settings: SandboxSettings,
  row: SandboxSettingsRow | null,
): SandboxSettings {
  if (!row) return settings

  return {
    ...settings,
    rateLimit: {
      enabled: row.rate_limit_enabled,
      maxPlacements: row.max_placements,
      windowMinutes: Number(row.window_minutes),
      perProp: row.per_prop_limits ?? {},
    },
  }
}

export async function fetchLayoutLocked(): Promise<boolean> {
  if (!supabase) return false

  const { data, error } = await supabase.rpc('is_layout_locked')
  if (error) {
    console.error('Failed to fetch layout lock state:', error.message)
    return false
  }

  return data === true
}

export async function fetchRemoteSandboxSettings(): Promise<SandboxSettingsRow | null> {
  if (!supabase) return null

  const { data, error } = await supabase
    .from('sandbox_settings')
    .select('rate_limit_enabled, max_placements, window_minutes, per_prop_limits, layout_locked')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch sandbox settings:', error.message)
    const layout_locked = await fetchLayoutLocked()
    return {
      rate_limit_enabled: DEFAULT_RATE_LIMIT.enabled,
      max_placements: DEFAULT_RATE_LIMIT.maxPlacements,
      window_minutes: DEFAULT_RATE_LIMIT.windowMinutes,
      per_prop_limits: {},
      layout_locked,
    }
  }

  return {
    ...(data as SandboxSettingsRow),
    layout_locked: Boolean((data as SandboxSettingsRow).layout_locked),
  }
}

/** @deprecated Use fetchRemoteSandboxSettings */
export async function fetchRemoteRateLimitSettings(): Promise<SandboxSettingsRow | null> {
  return fetchRemoteSandboxSettings()
}

export async function syncRateLimitSettingsToRemote(
  rateLimit: RateLimitSettings,
  adminPassword: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const { data, error } = await supabase.rpc('update_sandbox_rate_limits', {
    p_admin_password: adminPassword,
    p_rate_limit_enabled: rateLimit.enabled,
    p_max_placements: rateLimit.maxPlacements,
    p_window_minutes: rateLimit.windowMinutes,
    p_per_prop_limits: rateLimit.perProp,
    p_sync_admin_password: true,
  })

  if (error) return { ok: false, message: error.message }
  if (data !== true) return { ok: false, message: 'Admin authorization failed.' }

  return { ok: true }
}

export async function registerAdminSession(adminPassword: string): Promise<boolean> {
  if (!supabase) return false

  const { data, error } = await supabase.rpc('register_admin_session', {
    p_password: adminPassword,
  })

  if (error) {
    console.error('Admin session registration failed:', error.message)
    return false
  }

  return data === true
}

export async function clearAdminSession(): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.rpc('clear_admin_session')
  if (error) console.error('Failed to clear admin session:', error.message)
}

export function getPropRateLimit(
  rateLimit: RateLimitSettings,
  propId: string,
): { enabled: boolean; maxPlacements: number; windowMinutes: number } {
  const perProp = rateLimit.perProp[propId]
  if (perProp) {
    return {
      enabled: rateLimit.enabled && perProp.enabled,
      maxPlacements: perProp.maxPlacements,
      windowMinutes: perProp.windowMinutes,
    }
  }

  return {
    enabled: rateLimit.enabled,
    maxPlacements: rateLimit.maxPlacements,
    windowMinutes: rateLimit.windowMinutes,
  }
}
