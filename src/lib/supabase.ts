import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function resolveSupabaseUrl(url: string | undefined): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

const supabaseUrl = resolveSupabaseUrl(rawUrl)

export const isSupabaseConfigured = Boolean(supabaseUrl && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, anonKey!)
  : null

export const LAYOUT_LOCKED_MESSAGE =
  'Layout is locked. New placements are disabled.'

export const RATE_LIMIT_MESSAGE =
  'Rate limit reached. Please wait before changing Manoel Island again.'

if (rawUrl && !supabaseUrl) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL must be an HTTP(S) API URL, e.g. https://YOUR_PROJECT_REF.supabase.co — not a postgres:// connection string.',
  )
}
