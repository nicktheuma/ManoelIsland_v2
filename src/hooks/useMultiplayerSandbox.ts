import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LAYOUT_LOCKED_MESSAGE, RATE_LIMIT_MESSAGE, isSupabaseConfigured, supabase } from '../lib/supabase'
import type { PlacedPropRow } from '../types/database'
import type { PlacedProp } from '../types/props'
import { placedPropPatchToRow, placedPropToInsert, rowToPlacedProp } from '../utils/placedPropsDb'
import {
  clearAdminSession,
  fetchLayoutLocked,
  fetchRemoteSandboxSettings,
  registerAdminSession,
} from '../utils/rateLimitSettings'
import { publishRateLimitSeconds } from '../utils/rateLimitStore'
import { setLayoutLocked as setLayoutLockedRemote, wipeAllProps, wipeMapClutter } from '../utils/adminOperations'

function deferAfterPaint(task: () => void) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(task)
  })
}

type InsertPropOptions = {
  isAdmin?: boolean
  onSyncError?: (message: string) => void
}

export type MultiplayerSandboxState = {
  enabled: boolean
  isLoading: boolean
  isAuthenticated: boolean
  isAdminSession: boolean
  layoutLocked: boolean
  placedProps: PlacedProp[]
  insertProp: (
    prop: PlacedProp,
    options?: InsertPropOptions,
  ) => { ok: true } | { ok: false; message: string }
  updateProp: (id: string, patch: Partial<PlacedProp>) => void
  deleteProp: (id: string) => void
  wipeMapClutter: () => Promise<{ ok: true; deletedCount: number } | { ok: false; message: string }>
  wipeAllProps: (
    adminPassword: string,
  ) => Promise<{ ok: true; deletedCount: number } | { ok: false; message: string }>
  setLayoutLocked: (
    locked: boolean,
  ) => Promise<{ ok: true; updatedCount: number } | { ok: false; message: string }>
  refreshPlacedProps: () => Promise<void>
  refreshRateLimitCooldown: (propType?: string) => Promise<void>
  registerAdminSession: (password: string) => Promise<boolean>
  clearAdminSession: () => Promise<void>
}

export function useMultiplayerSandbox(isAdmin = false): MultiplayerSandboxState {
  const enabled = isSupabaseConfigured
  const [isLoading, setIsLoading] = useState(enabled)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdminSession, setIsAdminSession] = useState(false)
  const [layoutLocked, setLayoutLocked] = useState(false)
  const [placedProps, setPlacedProps] = useState<PlacedProp[]>([])
  const [rateLimitSecondsRemaining, setRateLimitSecondsRemaining] = useState(0)
  const userIdRef = useRef<string | null>(null)
  const lastPropTypeRef = useRef<string | null>(null)
  const placedPropsRef = useRef<PlacedProp[]>([])

  useEffect(() => {
    placedPropsRef.current = placedProps
  }, [placedProps])

  const refreshRateLimitCooldown = useCallback(async (propType?: string) => {
    if (!supabase || isAdmin || isAdminSession) {
      setRateLimitSecondsRemaining(0)
      return
    }

    const resolvedPropType = propType ?? lastPropTypeRef.current ?? undefined
    const { data, error } = await supabase.rpc('get_rate_limit_cooldown_seconds', {
      p_prop_type: resolvedPropType ?? null,
    })
    if (error) return

    setRateLimitSecondsRemaining(typeof data === 'number' ? Math.max(0, data) : 0)
  }, [isAdmin, isAdminSession])

  useEffect(() => {
    publishRateLimitSeconds(isAdmin || isAdminSession ? 0 : rateLimitSecondsRemaining)
  }, [isAdmin, isAdminSession, rateLimitSecondsRemaining])

  const registerAdminSessionFn = useCallback(async (password: string) => {
    const ok = await registerAdminSession(password)
    setIsAdminSession(ok)
    if (ok) setRateLimitSecondsRemaining(0)
    return ok
  }, [])

  const clearAdminSessionFn = useCallback(async () => {
    await clearAdminSession()
    setIsAdminSession(false)
    setRateLimitSecondsRemaining(0)
  }, [])

  useEffect(() => {
    if (!enabled || !supabase) return

    let cancelled = false

    async function bootstrap() {
      setIsLoading(true)

      const { data: sessionData } = await supabase!.auth.getSession()
      let session = sessionData.session

      if (!session) {
        const { data: anonData, error: anonError } = await supabase!.auth.signInAnonymously()
        if (anonError) {
          console.error('Anonymous auth failed:', anonError.message)
          if (!cancelled) setIsLoading(false)
          return
        }
        session = anonData.session
      }

      if (!session || cancelled) {
        if (!cancelled) setIsLoading(false)
        return
      }

      userIdRef.current = session.user.id
      setIsAuthenticated(true)

      const [{ data, error }, locked] = await Promise.all([
        supabase!
          .from('placed_props')
          .select('*')
          .order('created_at', { ascending: true }),
        fetchLayoutLocked(),
      ])

      if (error) {
        console.error('Failed to load placed props:', error.message)
      } else if (!cancelled) {
        setPlacedProps((data as PlacedPropRow[]).map(rowToPlacedProp))
      }

      if (!cancelled) {
        setLayoutLocked(locked)
      }

      await fetchRemoteSandboxSettings()
      if (!cancelled) setIsLoading(false)
    }

    bootstrap()

    const {
      data: { subscription: authSubscription },
    } = supabase!.auth.onAuthStateChange((_event, session) => {
      userIdRef.current = session?.user.id ?? null
      setIsAuthenticated(Boolean(session))
    })

    const channel = supabase!
      .channel('placed_props_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'placed_props' },
        (payload) => {
          const prop = rowToPlacedProp(payload.new as PlacedPropRow)
          setPlacedProps((prev) =>
            prev.some((existing) => existing.id === prop.id) ? prev : [...prev, prop],
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'placed_props' },
        (payload) => {
          const prop = rowToPlacedProp(payload.new as PlacedPropRow)
          setPlacedProps((prev) =>
            prev.map((existing) => (existing.id === prop.id ? prop : existing)),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'placed_props' },
        (payload) => {
          const deletedId = (payload.old as { id?: string }).id
          if (!deletedId) return
          setPlacedProps((prev) => prev.filter((prop) => prop.id !== deletedId))
        },
      )
      .subscribe()

    const settingsChannel = supabase!
      .channel('sandbox_settings_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sandbox_settings' },
        (payload) => {
          const row = payload.new as { layout_locked?: boolean }
          if (typeof row.layout_locked !== 'boolean') return
          setLayoutLocked(row.layout_locked)
          setPlacedProps((prev) => prev.map((prop) => ({ ...prop, isLocked: row.layout_locked! })))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      authSubscription.unsubscribe()
      supabase!.removeChannel(channel)
      supabase!.removeChannel(settingsChannel)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void refreshRateLimitCooldown()
  }, [enabled, isAdmin, isAdminSession, refreshRateLimitCooldown])

  useEffect(() => {
    if (isAdmin || isAdminSession) {
      setRateLimitSecondsRemaining(0)
      return
    }

    if (rateLimitSecondsRemaining <= 0) return

    const timer = window.setInterval(() => {
      setRateLimitSecondsRemaining((seconds) => Math.max(0, seconds - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isAdmin, isAdminSession, rateLimitSecondsRemaining])

  const layoutLockedRef = useRef(layoutLocked)
  useEffect(() => {
    layoutLockedRef.current = layoutLocked
  }, [layoutLocked])

  const insertProp = useCallback(
    (
      prop: PlacedProp,
      options?: InsertPropOptions,
    ): { ok: true } | { ok: false; message: string } => {
      if (!supabase) return { ok: false, message: 'Multiplayer is not configured.' }

      const userId = userIdRef.current
      if (!userId) return { ok: false, message: 'Sign in required to place props.' }

      if (
        layoutLockedRef.current &&
        !options?.isAdmin &&
        !isAdminSession
      ) {
        return { ok: false, message: LAYOUT_LOCKED_MESSAGE }
      }

      lastPropTypeRef.current = prop.propId

      setPlacedProps((prev) =>
        prev.some((existing) => existing.id === prop.id) ? prev : [...prev, prop],
      )

      deferAfterPaint(() => {
        void (async () => {
          const { error } = await supabase!
            .from('placed_props')
            .insert(placedPropToInsert(prop, userId))

          if (!error) return

          setPlacedProps((prev) => prev.filter((existing) => existing.id !== prop.id))

          if (error.message.includes(RATE_LIMIT_MESSAGE) && !options?.isAdmin && !isAdminSession) {
            await refreshRateLimitCooldown(prop.propId)
            options?.onSyncError?.(RATE_LIMIT_MESSAGE)
            return
          }

          if (error.message.includes(LAYOUT_LOCKED_MESSAGE)) {
            options?.onSyncError?.(LAYOUT_LOCKED_MESSAGE)
            return
          }

          options?.onSyncError?.(error.message)
        })()
      })

      return { ok: true }
    },
    [isAdminSession, refreshRateLimitCooldown],
  )

  const updateProp = useCallback((id: string, patch: Partial<PlacedProp>) => {
    const previous = placedPropsRef.current.find((prop) => prop.id === id)
    if (!previous) return

    const nextProp = { ...previous, ...patch, id: previous.id }

    setPlacedProps((prev) =>
      prev.map((prop) => (prop.id === id ? nextProp : prop)),
    )

    if (!supabase) return

    const rowPatch = placedPropPatchToRow(patch)
    if (Object.keys(rowPatch).length === 0) return

    deferAfterPaint(() => {
      void (async () => {
        const { error } = await supabase!
          .from('placed_props')
          .update(rowPatch)
          .eq('id', id)

        if (error) {
          console.error('Failed to sync prop update:', error.message)
          setPlacedProps((prev) =>
            prev.map((prop) => (prop.id === id ? previous : prop)),
          )
        }
      })()
    })
  }, [])

  const refreshPlacedProps = useCallback(async () => {
    if (!supabase) return

    const { data, error } = await supabase
      .from('placed_props')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to refresh placed props:', error.message)
      return
    }

    setPlacedProps((data as PlacedPropRow[]).map(rowToPlacedProp))
  }, [])

  const wipeMapClutterFn = useCallback(async () => {
    const result = await wipeMapClutter()
    if (result.ok) await refreshPlacedProps()
    return result
  }, [refreshPlacedProps])

  const wipeAllPropsFn = useCallback(async (adminPassword: string) => {
    const result = await wipeAllProps(adminPassword)
    if (result.ok) await refreshPlacedProps()
    return result
  }, [refreshPlacedProps])

  const setLayoutLockedFn = useCallback(async (locked: boolean) => {
    setLayoutLocked(locked)
    setPlacedProps((prev) => prev.map((prop) => ({ ...prop, isLocked: locked })))

    const result = await setLayoutLockedRemote(locked)
    if (!result.ok) {
      const currentLocked = await fetchLayoutLocked()
      setLayoutLocked(currentLocked)
      setPlacedProps((prev) => prev.map((prop) => ({ ...prop, isLocked: currentLocked })))
      return result
    }

    setLayoutLocked(locked)
    return result
  }, [])

  const deleteProp = useCallback((id: string) => {
    const previous = placedPropsRef.current
    const removed = previous.find((prop) => prop.id === id)
    if (!removed) return

    setPlacedProps((prev) => prev.filter((prop) => prop.id !== id))

    if (!supabase) return

    deferAfterPaint(() => {
      void (async () => {
        const { error } = await supabase!.from('placed_props').delete().eq('id', id)
        if (error) {
          console.error('Failed to sync prop delete:', error.message)
          setPlacedProps((prev) =>
            prev.some((prop) => prop.id === id) ? prev : [...prev, removed],
          )
        }
      })()
    })
  }, [])

  return useMemo(
    () => ({
      enabled,
      isLoading,
      isAuthenticated,
      isAdminSession,
      layoutLocked,
      placedProps,
      insertProp,
      updateProp,
      deleteProp,
      wipeMapClutter: wipeMapClutterFn,
      wipeAllProps: wipeAllPropsFn,
      setLayoutLocked: setLayoutLockedFn,
      refreshPlacedProps,
      refreshRateLimitCooldown,
      registerAdminSession: registerAdminSessionFn,
      clearAdminSession: clearAdminSessionFn,
    }),
    [
      enabled,
      isLoading,
      isAuthenticated,
      isAdminSession,
      layoutLocked,
      placedProps,
      insertProp,
      updateProp,
      deleteProp,
      wipeMapClutterFn,
      wipeAllPropsFn,
      setLayoutLockedFn,
      refreshPlacedProps,
      refreshRateLimitCooldown,
      registerAdminSessionFn,
      clearAdminSessionFn,
    ],
  )
}
