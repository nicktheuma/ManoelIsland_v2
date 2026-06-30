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
import {
  DEFAULT_PROP_LIBRARY,
  DEFAULT_SANDBOX_SETTINGS,
  SANDBOX_STORAGE_KEY,
} from '../config/defaults'
import { mergePropDefinition } from '../config/propDefaults'
import {
  canRedo,
  canUndo,
  createInitialSandboxState,
  sandboxReducer,
} from '../store/sandboxReducer'
import { createPlacedProp, type PlacedProp } from '../types/props'
import type { PropDefinition } from '../types/propLibrary'
import type { SandboxSettings } from '../types/sandbox'
import { useMultiplayerSandbox } from '../hooks/useMultiplayerSandbox'
import { useLocalAdminActive } from '../hooks/useLocalAdminActive'
import { applyPlacementRules } from '../utils/placementRules'
import { fetchRemoteSandboxSettings, mergeRateLimitFromRow, syncRateLimitSettingsToRemote } from '../utils/rateLimitSettings'
import { LAYOUT_LOCKED_MESSAGE } from '../lib/supabase'
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
  rateLimitSecondsRemaining: number
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
  registerAdminSession: (password: string) => Promise<boolean>
  clearAdminSession: () => Promise<void>
  syncRateLimitSettings: (adminPassword: string) => Promise<{ ok: true } | { ok: false; message: string }>
  isAdminSession: boolean
  wipeMapClutter: () => Promise<{ ok: true; deletedCount: number } | { ok: false; message: string }>
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
  }
}

export function SandboxProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersistedState()
  const isAdmin = useLocalAdminActive()
  const multiplayer = useMultiplayerSandbox(isAdmin)
  const terrainHeightRef = useRef<((x: number, z: number) => number) | null>(null)
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
    localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(payload))
  }, [multiplayer.enabled, state.props.present, state.settings])

  useEffect(() => {
    if (!multiplayer.enabled) return

    let cancelled = false

    fetchRemoteSandboxSettings().then((row) => {
      if (cancelled || !row) return
      dispatch({
        type: 'PATCH_SETTINGS',
        patch: {
          rateLimit: mergeRateLimitFromRow(DEFAULT_SANDBOX_SETTINGS, row).rateLimit,
        },
      })
    })

    return () => {
      cancelled = true
    }
  }, [multiplayer.enabled])

  const syncRateLimitSettings = useCallback(
    async (adminPassword: string) =>
      syncRateLimitSettingsToRemote(state.settings.rateLimit, adminPassword),
    [state.settings.rateLimit],
  )

  const getPropDefinition = useCallback(
    (propId: string) => state.settings.propLibrary.find((prop) => prop.id === propId),
    [state.settings.propLibrary],
  )

  const registerTerrainHeight = useCallback((sampler: ((x: number, z: number) => number) | null) => {
    terrainHeightRef.current = sampler
  }, [])

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
    dispatch({ type: 'LOAD', props: [] })
    return { ok: true as const, deletedCount: placedPropsForRules.length }
  }, [multiplayer, placedPropsForRules.length])

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
      rateLimitSecondsRemaining: isAdmin || multiplayer.isAdminSession ? 0 : multiplayer.rateLimitSecondsRemaining,
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
      registerAdminSession: multiplayer.registerAdminSession,
      clearAdminSession: multiplayer.clearAdminSession,
      syncRateLimitSettings,
      isAdminSession: multiplayer.isAdminSession,
      wipeMapClutter,
      setLayoutLocked,
      isLayoutLocked,
    }),
    [state, isAdmin, isLayoutLocked, multiplayer, placeProp, updateProp, deleteProp, deleteSelected, wipeMapClutter, setLayoutLocked, getPropDefinition, registerTerrainHeight, syncRateLimitSettings],
  )

  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>
}

export function useSandbox(): SandboxContextValue {
  const context = useContext(SandboxContext)
  if (!context) throw new Error('useSandbox must be used within SandboxProvider')
  return context
}
