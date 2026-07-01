import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { DEFAULT_PROP_LIBRARY, DEFAULT_SANDBOX_SETTINGS, SANDBOX_STORAGE_KEY } from '../config/defaults'
import { normalizeSceneAppearance } from '../config/sceneAppearance'
import { mergePropDefinition } from '../config/propDefaults'
import {
  canRedo,
  canUndo,
  createInitialSandboxState,
  sandboxReducer,
} from '../store/sandboxReducer'
import { createPlacedProp, type PlacedProp } from '../types/props'
import type { PropDefinition } from '../types/propLibrary'
import type { CapturedCameraView, SandboxSettings, SceneAppearance } from '../types/sandbox'
import { useMultiplayerSandbox } from '../hooks/useMultiplayerSandbox'
import { useLocalAdminActive } from '../hooks/useLocalAdminActive'
import { applyPlacementRules } from '../utils/placementRules'
import { fetchRemoteSandboxSettings, mergeRateLimitFromRow, syncRateLimitSettingsToRemote } from '../utils/rateLimitSettings'
import { syncSceneAppearanceToRemote } from '../utils/sceneAppearanceSettings'
import { LAYOUT_LOCKED_MESSAGE } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { resolvePropVariation } from '../utils/propVariation'

type PersistedSandbox = {
  props: PlacedProp[]
  settings: SandboxSettings
}

type SandboxContextValue = {
  placedProps: PlacedProp[]
  settings: SandboxSettings
  selectedPropId: string | null
  placementError: string | null
  isMultiplayer: boolean
  isMultiplayerLoading: boolean
  canUndo: boolean
  canRedo: boolean
  selectProp: (id: string | null) => void
  placeProp: (
    propId: string,
    position: [number, number, number],
    overrides?: Partial<Pick<PlacedProp, 'rotation' | 'scale' | 'color' | 'metadata'>>,
  ) => Promise<boolean>
  updateProp: (id: string, patch: Partial<PlacedProp>) => void
  deleteProp: (id: string) => void
  deleteSelected: () => void
  undo: () => void
  redo: () => void
  setSettings: (settings: SandboxSettings) => void
  patchSettings: (patch: Partial<SandboxSettings>) => void
  getPropDefinition: (propId: string) => PropDefinition | undefined
  clearPlacementError: () => void
  registerTerrainHeight: (sampler: ((x: number, z: number) => number) | null) => void
  registerCameraCapture: (fn: (() => CapturedCameraView | null) | null) => void
  captureCameraView: () => CapturedCameraView | null
  registerAdminSession: (password: string) => Promise<boolean>
  clearAdminSession: () => Promise<void>
  syncRateLimitSettings: (adminPassword: string) => Promise<{ ok: true } | { ok: false; message: string }>
  syncSceneAppearanceSettings: (
    sceneAppearance: SceneAppearance,
    adminPassword: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  isAdminSession: boolean
  wipeMapClutter: () => Promise<{ ok: true; deletedCount: number } | { ok: false; message: string }>
  wipeAllProps: (
    adminPassword: string,
  ) => Promise<{ ok: true; deletedCount: number } | { ok: false; message: string }>
  setLayoutLocked: (
    locked: boolean,
  ) => Promise<{ ok: true; updatedCount: number } | { ok: false; message: string }>
  isLayoutLocked: boolean
}

const SandboxContext = createContext<SandboxContextValue | null>(null)

function loadPersistedState(): PersistedSandbox | null {
  try {
    const raw = localStorage.getItem(SANDBOX_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedSandbox
  } catch {
    return null
  }
}

function mergeSettings(stored: SandboxSettings | undefined): SandboxSettings {
  if (!stored) return DEFAULT_SANDBOX_SETTINGS
  return {
    ...DEFAULT_SANDBOX_SETTINGS,
    ...stored,
    placementRules: { ...DEFAULT_SANDBOX_SETTINGS.placementRules, ...stored.placementRules },
    userVisibility: { ...DEFAULT_SANDBOX_SETTINGS.userVisibility, ...stored.userVisibility },
    categories: stored.categories?.length ? stored.categories : DEFAULT_SANDBOX_SETTINGS.categories,
    propLibrary: stored.propLibrary?.length
      ? stored.propLibrary.map((storedProp) => {
          const fallback = DEFAULT_PROP_LIBRARY.find((prop) => prop.id === storedProp.id)
          return fallback ? mergePropDefinition(storedProp, fallback) : storedProp
        })
      : DEFAULT_SANDBOX_SETTINGS.propLibrary,
    zones: stored.zones ?? [],
    rateLimit: {
      ...DEFAULT_SANDBOX_SETTINGS.rateLimit,
      ...stored.rateLimit,
      perProp: {
        ...DEFAULT_SANDBOX_SETTINGS.rateLimit.perProp,
        ...stored.rateLimit?.perProp,
      },
    },
    sceneAppearance: normalizeSceneAppearance({
      ...DEFAULT_SANDBOX_SETTINGS.sceneAppearance,
      ...stored.sceneAppearance,
    }),
  }
}

export function SandboxProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersistedState()
  const isAdmin = useLocalAdminActive()
  const multiplayer = useMultiplayerSandbox(isAdmin)
  const terrainHeightRef = useRef<((x: number, z: number) => number) | null>(null)
  const cameraCaptureRef = useRef<(() => CapturedCameraView | null) | null>(null)
  const [state, dispatch] = useReducer(
    sandboxReducer,
    createInitialSandboxState(
      multiplayer.enabled ? [] : (persisted?.props ?? []),
      mergeSettings(persisted?.settings),
    ),
  )

  useEffect(() => {
    const payload: PersistedSandbox = {
      props: multiplayer.enabled ? [] : state.props.present,
      settings: state.settings,
    }

    const timer = window.setTimeout(() => {
      localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(payload))
    }, 500)

    return () => window.clearTimeout(timer)
  }, [multiplayer.enabled, state.props.present, state.settings])

  useEffect(() => {
    if (!multiplayer.enabled) return

    let cancelled = false

    fetchRemoteSandboxSettings().then((row) => {
      if (cancelled || !row) return
      const merged = mergeRateLimitFromRow(DEFAULT_SANDBOX_SETTINGS, row)
      dispatch({
        type: 'PATCH_SETTINGS',
        patch: {
          rateLimit: merged.rateLimit,
          sceneAppearance: merged.sceneAppearance,
        },
      })
    })

    const settingsChannel = supabase
      ?.channel('sandbox_scene_appearance')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sandbox_settings' },
        (payload) => {
          const row = payload.new as { scene_appearance?: Partial<SceneAppearance> }
          if (!row.scene_appearance) return
          dispatch({
            type: 'PATCH_SETTINGS',
            patch: {
              sceneAppearance: normalizeSceneAppearance(row.scene_appearance),
            },
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      if (settingsChannel) supabase?.removeChannel(settingsChannel)
    }
  }, [multiplayer.enabled])

  const syncRateLimitSettings = useCallback(
    async (adminPassword: string) =>
      syncRateLimitSettingsToRemote(state.settings.rateLimit, adminPassword),
    [state.settings.rateLimit],
  )

  const syncSceneAppearanceSettings = useCallback(
    async (sceneAppearance: SceneAppearance, adminPassword: string) =>
      syncSceneAppearanceToRemote(sceneAppearance, adminPassword),
    [],
  )

  const getPropDefinition = useCallback(
    (propId: string) => state.settings.propLibrary.find((prop) => prop.id === propId),
    [state.settings.propLibrary],
  )

  const registerTerrainHeight = useCallback((sampler: ((x: number, z: number) => number) | null) => {
    terrainHeightRef.current = sampler
  }, [])

  const registerCameraCapture = useCallback((fn: (() => CapturedCameraView | null) | null) => {
    cameraCaptureRef.current = fn
  }, [])

  const captureCameraView = useCallback(() => cameraCaptureRef.current?.() ?? null, [])

  const placedPropsForRules = multiplayer.enabled ? multiplayer.placedProps : state.props.present

  const canMutateProp = useCallback(
    (id: string) => {
      const prop = placedPropsForRules.find((item) => item.id === id)
      if (!prop?.isLocked) return true
      return isAdmin
    },
    [isAdmin, placedPropsForRules],
  )

  const isLayoutLocked = multiplayer.enabled ? multiplayer.layoutLocked : false

  const placeProp = useCallback(
    async (
      propId: string,
      position: [number, number, number],
      overrides?: Partial<Pick<PlacedProp, 'rotation' | 'scale' | 'color' | 'metadata'>>,
    ) => {
      const definition = state.settings.propLibrary.find((prop) => prop.id === propId)
      if (!definition) return false

      const variation = resolvePropVariation(definition)
      const scale = overrides?.scale ?? variation.scale
      const color = overrides?.color ?? variation.color

      const { position: adjustedPosition, validation } = applyPlacementRules(
        position,
        propId,
        scale,
        state.settings,
        placedPropsForRules,
        terrainHeightRef.current ?? undefined,
      )

      if (!validation.ok) {
        dispatch({ type: 'SET_PLACEMENT_ERROR', message: validation.reason ?? 'Placement blocked.' })
        return false
      }

      if (isLayoutLocked && !isAdmin) {
        dispatch({ type: 'SET_PLACEMENT_ERROR', message: LAYOUT_LOCKED_MESSAGE })
        return false
      }

      const prop = createPlacedProp(propId, adjustedPosition, { color, scale }, overrides)

      if (multiplayer.enabled) {
        const result = multiplayer.insertProp(prop, {
          isAdmin,
          onSyncError: (message) =>
            dispatch({ type: 'SET_PLACEMENT_ERROR', message }),
        })
        if (!result.ok) {
          dispatch({ type: 'SET_PLACEMENT_ERROR', message: result.message })
          return false
        }
        return true
      }

      dispatch({ type: 'PLACE_PROP', prop })
      return true
    },
    [multiplayer, isAdmin, isLayoutLocked, placedPropsForRules, state.settings],
  )

  const deleteProp = useCallback(
    (id: string) => {
      if (!canMutateProp(id)) return

      if (multiplayer.enabled) {
        multiplayer.deleteProp(id)
        if (state.selectedPropId === id) {
          dispatch({ type: 'SELECT_PROP', id: null })
        }
        return
      }
      dispatch({ type: 'DELETE_PROP', id })
    },
    [multiplayer, canMutateProp, state.selectedPropId],
  )

  const wipeMapClutter = useCallback(async () => {
    if (multiplayer.enabled) return multiplayer.wipeMapClutter()
    const count = placedPropsForRules.length
    dispatch({ type: 'LOAD', props: [] })
    return { ok: true as const, deletedCount: count }
  }, [multiplayer, placedPropsForRules.length])

  const wipeAllProps = useCallback(
    async (adminPassword: string) => {
      if (multiplayer.enabled) return multiplayer.wipeAllProps(adminPassword)
      const count = placedPropsForRules.length
      dispatch({ type: 'LOAD', props: [] })
      return { ok: true as const, deletedCount: count }
    },
    [multiplayer, placedPropsForRules.length],
  )

  const setLayoutLocked = useCallback(
    async (locked: boolean) => {
      if (multiplayer.enabled) return multiplayer.setLayoutLocked(locked)
      return { ok: true as const, updatedCount: placedPropsForRules.length }
    },
    [multiplayer, placedPropsForRules.length],
  )

  const deleteSelected = useCallback(() => {
    if (!state.selectedPropId) return
    deleteProp(state.selectedPropId)
  }, [deleteProp, state.selectedPropId])

  const updateProp = useCallback(
    (id: string, patch: Partial<PlacedProp>) => {
      if (!canMutateProp(id)) return

      if (multiplayer.enabled) {
        multiplayer.updateProp(id, patch)
        return
      }
      dispatch({ type: 'UPDATE_PROP', id, patch })
    },
    [canMutateProp, multiplayer],
  )

  const value = useMemo<SandboxContextValue>(
    () => ({
      placedProps: multiplayer.enabled ? multiplayer.placedProps : state.props.present,
      settings: state.settings,
      selectedPropId: state.selectedPropId,
      placementError: state.placementError,
      isMultiplayer: multiplayer.enabled,
      isMultiplayerLoading: multiplayer.isLoading,
      canUndo: multiplayer.enabled ? false : canUndo(state),
      canRedo: multiplayer.enabled ? false : canRedo(state),
      selectProp: (id) => dispatch({ type: 'SELECT_PROP', id }),
      placeProp,
      updateProp,
      deleteProp,
      deleteSelected,
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
      setSettings: (settings) => dispatch({ type: 'SET_SETTINGS', settings }),
      patchSettings: (patch) => dispatch({ type: 'PATCH_SETTINGS', patch }),
      getPropDefinition,
      clearPlacementError: () => dispatch({ type: 'SET_PLACEMENT_ERROR', message: null }),
      registerTerrainHeight,
      registerCameraCapture,
      captureCameraView,
      registerAdminSession: multiplayer.registerAdminSession,
      clearAdminSession: multiplayer.clearAdminSession,
      syncRateLimitSettings,
      syncSceneAppearanceSettings,
      isAdminSession: multiplayer.isAdminSession,
      wipeMapClutter,
      wipeAllProps,
      setLayoutLocked,
      isLayoutLocked,
    }),
    [state, isAdmin, isLayoutLocked, multiplayer, placeProp, updateProp, deleteProp, deleteSelected, wipeMapClutter, wipeAllProps, setLayoutLocked, getPropDefinition, registerTerrainHeight, registerCameraCapture, captureCameraView, syncRateLimitSettings, syncSceneAppearanceSettings],
  )

  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>
}

export function useSandbox(): SandboxContextValue {
  const context = useContext(SandboxContext)
  if (!context) throw new Error('useSandbox must be used within SandboxProvider')
  return context
}
