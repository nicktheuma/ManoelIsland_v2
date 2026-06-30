import { supabase, isSupabaseConfigured } from '../lib/supabase'

export type AdminProfile = {
  id: string
  username: string | null
  role: 'user' | 'admin'
}

export async function fetchMyProfile(): Promise<AdminProfile | null> {
  if (!supabase) return null

  const { data, error } = await supabase.rpc('get_my_profile')
  if (error || !data?.length) return null

  const row = data[0] as AdminProfile
  return row
}

export async function loginWithSupabaseAdmin(
  email: string,
  password: string,
): Promise<{ ok: true; profile: AdminProfile } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: 'Supabase is not configured.' }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    return { ok: false, message: 'Invalid credentials.' }
  }

  const profile = await fetchMyProfile()
  if (!profile || profile.role !== 'admin') {
    await supabase.auth.signOut()
    await supabase.auth.signInAnonymously()
    return { ok: false, message: 'Access denied.' }
  }

  return { ok: true, profile }
}

export async function restoreAnonymousSession(): Promise<void> {
  if (!supabase) return

  const { data } = await supabase.auth.getSession()
  if (data.session?.user.is_anonymous) return

  await supabase.auth.signOut()
  await supabase.auth.signInAnonymously()
}

export function supportsSupabaseAdminAuth(): boolean {
  return isSupabaseConfigured
}
