import type { PlacedProp } from '../types/props'
import type { SandboxSettings } from '../types/sandbox'
import { DEFAULT_SANDBOX_SETTINGS } from '../config/defaults'

type PropHistory = {
  past: PlacedProp[][]
  present: PlacedProp[]
  future: PlacedProp[][]
}

export type SandboxState = {
  props: PropHistory
  selectedPropId: string | null
  settings: SandboxSettings
  placementError: string | null
}

export type SandboxAction =
  | { type: 'PLACE_PROP'; prop: PlacedProp }
  | { type: 'UPDATE_PROP'; id: string; patch: Partial<PlacedProp> }
  | { type: 'DELETE_PROP'; id: string }
  | { type: 'DELETE_SELECTED' }
  | { type: 'SELECT_PROP'; id: string | null }
  | { type: 'SET_SETTINGS'; settings: SandboxSettings }
  | { type: 'PATCH_SETTINGS'; patch: Partial<SandboxSettings> }
  | { type: 'SET_PLACEMENT_ERROR'; message: string | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD'; props: PlacedProp[]; settings?: SandboxSettings }

const MAX_HISTORY = 50

function pushHistory(history: PropHistory, nextPresent: PlacedProp[]): PropHistory {
  const past = [...history.past, history.present].slice(-MAX_HISTORY)
  return { past, present: nextPresent, future: [] }
}

export function createInitialSandboxState(
  props: PlacedProp[] = [],
  settings: SandboxSettings = DEFAULT_SANDBOX_SETTINGS,
): SandboxState {
  return {
    props: { past: [], present: props, future: [] },
    selectedPropId: null,
    settings,
    placementError: null,
  }
}

export function sandboxReducer(state: SandboxState, action: SandboxAction): SandboxState {
  switch (action.type) {
    case 'PLACE_PROP':
      return {
        ...state,
        props: pushHistory(state.props, [...state.props.present, action.prop]),
        placementError: null,
      }

    case 'UPDATE_PROP': {
      const nextPresent = state.props.present.map((prop) =>
        prop.id === action.id ? { ...prop, ...action.patch, id: prop.id } : prop,
      )
      return {
        ...state,
        props: pushHistory(state.props, nextPresent),
        placementError: null,
      }
    }

    case 'DELETE_PROP': {
      const nextPresent = state.props.present.filter((prop) => prop.id !== action.id)
      return {
        ...state,
        props: pushHistory(state.props, nextPresent),
        selectedPropId: state.selectedPropId === action.id ? null : state.selectedPropId,
        placementError: null,
      }
    }

    case 'DELETE_SELECTED':
      if (!state.selectedPropId) return state
      return sandboxReducer(state, { type: 'DELETE_PROP', id: state.selectedPropId })

    case 'SELECT_PROP':
      return { ...state, selectedPropId: action.id }

    case 'SET_SETTINGS':
      return { ...state, settings: action.settings }

    case 'PATCH_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.patch,
          placementRules: {
            ...state.settings.placementRules,
            ...action.patch.placementRules,
          },
          userVisibility: {
            ...state.settings.userVisibility,
            ...action.patch.userVisibility,
          },
          zones: action.patch.zones ?? state.settings.zones,
          categories: action.patch.categories ?? state.settings.categories,
          propLibrary: action.patch.propLibrary ?? state.settings.propLibrary,
          rateLimit: action.patch.rateLimit
            ? {
                ...state.settings.rateLimit,
                ...action.patch.rateLimit,
                perProp: {
                  ...state.settings.rateLimit.perProp,
                  ...action.patch.rateLimit.perProp,
                },
              }
            : state.settings.rateLimit,
        },
      }

    case 'SET_PLACEMENT_ERROR':
      return { ...state, placementError: action.message }

    case 'UNDO': {
      const { past, present, future } = state.props
      if (past.length === 0) return state
      const previous = past[past.length - 1]
      return {
        ...state,
        props: {
          past: past.slice(0, -1),
          present: previous,
          future: [present, ...future],
        },
        selectedPropId: null,
      }
    }

    case 'REDO': {
      const { past, present, future } = state.props
      if (future.length === 0) return state
      const [next, ...rest] = future
      return {
        ...state,
        props: {
          past: [...past, present],
          present: next,
          future: rest,
        },
        selectedPropId: null,
      }
    }

    case 'LOAD':
      return {
        ...state,
        props: { past: [], present: action.props, future: [] },
        settings: action.settings ?? state.settings,
        selectedPropId: null,
        placementError: null,
      }

    default:
      return state
  }
}

export function canUndo(state: SandboxState): boolean {
  return state.props.past.length > 0
}

export function canRedo(state: SandboxState): boolean {
  return state.props.future.length > 0
}
