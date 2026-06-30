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
import { applyPlacementRules } from '../utils/placementRules'
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
  canUndo: boolean
  canRedo: boolean
  selectProp: (id: string | null) => void
  placeProp: (
    propId: string,
    position: [number, number, number],
    overrides?: Partial<Pick<PlacedProp, 'rotation' | 'scale' | 'color' | 'metadata'>>,
  ) => boolean
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
  }
}

export function SandboxProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersistedState()
  const terrainHeightRef = useRef<((x: number, z: number) => number) | null>(null)
  const [state, dispatch] = useReducer(
    sandboxReducer,
    createInitialSandboxState(
      persisted?.props ?? [],
      mergeSettings(persisted?.settings),
    ),
  )

  useEffect(() => {
    const payload: PersistedSandbox = {
      props: state.props.present,
      settings: state.settings,
    }
    localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(payload))
  }, [state.props.present, state.settings])

  const getPropDefinition = useCallback(
    (propId: string) => state.settings.propLibrary.find((prop) => prop.id === propId),
    [state.settings.propLibrary],
  )

  const registerTerrainHeight = useCallback((sampler: ((x: number, z: number) => number) | null) => {
    terrainHeightRef.current = sampler
  }, [])

  const placeProp = useCallback(
    (
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
        state.props.present,
        terrainHeightRef.current ?? undefined,
      )

      if (!validation.ok) {
        dispatch({ type: 'SET_PLACEMENT_ERROR', message: validation.reason ?? 'Placement blocked.' })
        return false
      }

      dispatch({
        type: 'PLACE_PROP',
        prop: createPlacedProp(propId, adjustedPosition, { color, scale }, overrides),
      })
      return true
    },
    [state.props.present, state.settings],
  )

  const value = useMemo<SandboxContextValue>(
    () => ({
      placedProps: state.props.present,
      settings: state.settings,
      selectedPropId: state.selectedPropId,
      placementError: state.placementError,
      canUndo: canUndo(state),
      canRedo: canRedo(state),
      selectProp: (id) => dispatch({ type: 'SELECT_PROP', id }),
      placeProp,
      updateProp: (id, patch) => dispatch({ type: 'UPDATE_PROP', id, patch }),
      deleteProp: (id) => dispatch({ type: 'DELETE_PROP', id }),
      deleteSelected: () => dispatch({ type: 'DELETE_SELECTED' }),
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
      setSettings: (settings) => dispatch({ type: 'SET_SETTINGS', settings }),
      patchSettings: (patch) => dispatch({ type: 'PATCH_SETTINGS', patch }),
      getPropDefinition,
      clearPlacementError: () => dispatch({ type: 'SET_PLACEMENT_ERROR', message: null }),
      registerTerrainHeight,
    }),
    [state, placeProp, getPropDefinition, registerTerrainHeight],
  )

  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>
}

export function useSandbox(): SandboxContextValue {
  const context = useContext(SandboxContext)
  if (!context) throw new Error('useSandbox must be used within SandboxProvider')
  return context
}
