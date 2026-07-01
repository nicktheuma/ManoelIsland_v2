import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_PROP_LIBRARY, DEFAULT_SANDBOX_SETTINGS, SANDBOX_STORAGE_KEY } from '../config/defaults'
import { normalizeSceneAppearance } from '../config/sceneAppearance'
import { mergePropDefinition } from '../config/propDefaults'
import {
  createInitialSandboxState,
  sandboxReducer,
} from '../store/sandboxReducer'
import {
  canRedoStack,
  canUndoStack,
  createUndoStack,
  pushUndoCommand,
  redoCommand,
  undoCommand,
  type UndoCommand,
} from '../store/undoStack'
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

const REMOTE_SCENE_APPEARANCE_GRACE_MS = 3000

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
  pushUndo: (command: UndoCommand) => void
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
      terrainSculpt: {
        ...DEFAULT_SANDBOX_SETTINGS.rateLimit.terrainSculpt,
        ...stored.rateLimit?.terrainSculpt,
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
  const undoStackRef = useRef(createUndoStack())
  const [undoRevision, setUndoRevision] = useState(0)
  const localSceneAppearancePatchAtRef = useRef(0)
  const bumpUndoRevision = useCallback(() => setUndoRevision((value) => value + 1), [])

  const pushUndo = useCallback(
    (command: UndoCommand) => {
      pushUndoCommand(undoStackRef.current, command)
      bumpUndoRevision()
    },
    [bumpUndoRevision],
  )

  const runUndo = useCallback(() => {
    const command = undoCommand(undoStackRef.current)
    if (!command) return false
    void Promise.resolve(command.undo()).finally(() => bumpUndoRevision())
    return true
  }, [bumpUndoRevision])

  const runRedo = useCallback(() => {
    const command = redoCommand(undoStackRef.current)
    if (!command) return false
    void Promise.resolve(command.redo()).finally(() => bumpUndoRevision())
    return true
  }, [bumpUndoRevision])

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
          if (Date.now() - localSceneAppearancePatchAtRef.current < REMOTE_SCENE_APPEARANCE_GRACE_MS) {
            return
          }
          dispatch({
            type: 'PATCH_SETTINGS',
            patch: {
              sceneAppearance: row.scene_appearance as SceneAppearance,
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
    async (sceneAppearance: SceneAppearance, adminPassword: string) => {
      localSceneAppearancePatchAtRef.current = Date.now()
      const result = await syncSceneAppearanceToRemote(sceneAppearance, adminPassword)
      if (result.ok) {
        localSceneAppearancePatchAtRef.current = Date.now()
      }
      return result
    },
    [],
  )

  const patchSettings = useCallback((patch: Partial<SandboxSettings>) => {
    if (patch.sceneAppearance) {
      localSceneAppearancePatchAtRef.current = Date.now()
    }
    dispatch({ type: 'PATCH_SETTINGS', patch })
  }, [])

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
  const placedPropsRef = useRef(placedPropsForRules)
  placedPropsRef.current = placedPropsForRules

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
        pushUndo({
          label: 'Place prop',
          undo: () => multiplayer.deleteProp(prop.id),
          redo: () => {
            multiplayer.insertProp(prop, { isAdmin })
          },
        })
        return true
      }

      dispatch({ type: 'SET_PROPS', props: [...placedPropsRef.current, prop] })
      pushUndo({
        label: 'Place prop',
        undo: () =>
          dispatch({
            type: 'SET_PROPS',
            props: placedPropsRef.current.filter((item) => item.id !== prop.id),
          }),
        redo: () =>
          dispatch({
            type: 'SET_PROPS',
            props: [...placedPropsRef.current.filter((item) => item.id !== prop.id), prop],
          }),
      })
      return true
    },
    [multiplayer, isAdmin, isLayoutLocked, placedPropsForRules, pushUndo, state.settings],
  )

  const deleteProp = useCallback(
    (id: string) => {
      if (!canMutateProp(id)) return

      const existing = placedPropsForRules.find((prop) => prop.id === id)
      if (!existing) return

      if (multiplayer.enabled) {
        pushUndo({
          label: 'Delete prop',
          undo: () => {
            multiplayer.insertProp(existing, { isAdmin })
          },
          redo: () => multiplayer.deleteProp(id),
        })
        multiplayer.deleteProp(id)
        if (state.selectedPropId === id) {
          dispatch({ type: 'SELECT_PROP', id: null })
        }
        return
      }

      pushUndo({
        label: 'Delete prop',
        undo: () =>
          dispatch({
            type: 'SET_PROPS',
            props: [...placedPropsRef.current.filter((item) => item.id !== id), existing],
          }),
        redo: () =>
          dispatch({
            type: 'SET_PROPS',
            props: placedPropsRef.current.filter((item) => item.id !== id),
          }),
      })
      dispatch({
        type: 'SET_PROPS',
        props: placedPropsRef.current.filter((item) => item.id !== id),
      })
    },
    [canMutateProp, isAdmin, multiplayer, placedPropsForRules, pushUndo, state.selectedPropId],
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

      const existing = placedPropsForRules.find((prop) => prop.id === id)
      if (!existing) return

      const before = { ...existing }
      const after = { ...existing, ...patch, id: existing.id }

      if (multiplayer.enabled) {
        pushUndo({
          label: 'Edit prop',
          undo: () => multiplayer.updateProp(id, before),
          redo: () => multiplayer.updateProp(id, after),
        })
        multiplayer.updateProp(id, patch)
        return
      }

      pushUndo({
        label: 'Edit prop',
        undo: () =>
          dispatch({
            type: 'SET_PROPS',
            props: placedPropsRef.current.map((item) => (item.id === id ? before : item)),
          }),
        redo: () =>
          dispatch({
            type: 'SET_PROPS',
            props: placedPropsRef.current.map((item) => (item.id === id ? after : item)),
          }),
      })
      dispatch({
        type: 'SET_PROPS',
        props: placedPropsRef.current.map((item) => (item.id === id ? after : item)),
      })
    },
    [canMutateProp, multiplayer, placedPropsForRules, pushUndo],
  )

  const commandCanUndo = canUndoStack(undoStackRef.current)
  const commandCanRedo = canRedoStack(undoStackRef.current)

  const value = useMemo<SandboxContextValue>(
    () => ({
      placedProps: multiplayer.enabled ? multiplayer.placedProps : state.props.present,
      settings: state.settings,
      selectedPropId: state.selectedPropId,
      placementError: state.placementError,
      isMultiplayer: multiplayer.enabled,
      isMultiplayerLoading: multiplayer.isLoading,
      canUndo: commandCanUndo,
      canRedo: commandCanRedo,
      selectProp: (id) => dispatch({ type: 'SELECT_PROP', id }),
      placeProp,
      updateProp,
      deleteProp,
      deleteSelected,
      undo: () => {
        void runUndo()
      },
      redo: () => {
        void runRedo()
      },
      pushUndo,
      setSettings: (settings) => dispatch({ type: 'SET_SETTINGS', settings }),
      patchSettings,
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
    [
      state,
      isAdmin,
      isLayoutLocked,
      multiplayer,
      placeProp,
      updateProp,
      deleteProp,
      deleteSelected,
      wipeMapClutter,
      wipeAllProps,
      setLayoutLocked,
      getPropDefinition,
      registerTerrainHeight,
      registerCameraCapture,
      captureCameraView,
      syncRateLimitSettings,
      syncSceneAppearanceSettings,
      patchSettings,
      pushUndo,
      runUndo,
      runRedo,
      commandCanUndo,
      commandCanRedo,
      undoRevision,
    ],
  )

  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>
}

export function useSandbox(): SandboxContextValue {
  const context = useContext(SandboxContext)
  if (!context) throw new Error('useSandbox must be used within SandboxProvider')
  return context
}
