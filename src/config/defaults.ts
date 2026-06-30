import type { PropCategory, PropDefinition } from '../types/propLibrary'
import type { SandboxSettings } from '../types/sandbox'
import { withPropDefaults } from './propDefaults'

export const DEFAULT_CATEGORIES: PropCategory[] = [
  {
    id: 'vegetation',
    name: 'Vegetation',
    description: 'Static trees and planting.',
    userVisible: true,
  },
  {
    id: 'street-furniture',
    name: 'Street Furniture',
    description: 'Benches, shelters, and fixtures.',
    userVisible: true,
  },
  {
    id: 'animated',
    name: 'Animated',
    description: 'Props with continuous motion.',
    userVisible: false,
  },
  {
    id: 'temporal',
    name: 'Temporal',
    description: 'Props that evolve over days and weeks.',
    userVisible: false,
  },
  {
    id: 'agents',
    name: 'Agents',
    description: 'People and vehicles with simple pathing.',
    userVisible: false,
  },
]

function withPlacement(
  prop: Omit<PropDefinition, 'placement' | 'variation'>,
): PropDefinition {
  return withPropDefaults(prop)
}

export const DEFAULT_PROP_LIBRARY: PropDefinition[] = [
  withPlacement({
    id: 'tree-oak',
    name: 'Oak Tree',
    categoryId: 'vegetation',
    behavior: 'static',
    geometry: 'tree',
    defaultColor: '#22863a',
    defaultScale: 1,
    userPlaceable: true,
  }),
  withPlacement({
    id: 'bench-wood',
    name: 'Wood Bench',
    categoryId: 'street-furniture',
    behavior: 'static',
    geometry: 'bench',
    defaultColor: '#8b4513',
    defaultScale: 1,
    userPlaceable: true,
  }),
  withPlacement({
    id: 'pavilion-canopy',
    name: 'Canopy Pavilion',
    categoryId: 'street-furniture',
    behavior: 'static',
    geometry: 'pavilion',
    defaultColor: '#94a3b8',
    defaultScale: 1,
    userPlaceable: true,
  }),
  withPlacement({
    id: 'flag-animated',
    name: 'Animated Flag',
    categoryId: 'animated',
    behavior: 'animated',
    geometry: 'box',
    defaultColor: '#f59e0b',
    defaultScale: 1,
    userPlaceable: false,
    behaviorConfig: { animationSpeed: 1.5 },
  }),
  withPlacement({
    id: 'construction-temporal',
    name: 'Construction Phase',
    categoryId: 'temporal',
    behavior: 'temporal',
    geometry: 'box',
    defaultColor: '#f97316',
    defaultScale: 1,
    userPlaceable: false,
    behaviorConfig: { durationDays: 14, durationWeeks: 2 },
  }),
  withPlacement({
    id: 'pedestrian-agent',
    name: 'Pedestrian',
    categoryId: 'agents',
    behavior: 'agentic',
    geometry: 'person',
    defaultColor: '#3b82f6',
    defaultScale: 1,
    userPlaceable: false,
    behaviorConfig: { agentSpeed: 0.8, pathRadius: 4 },
  }),
  withPlacement({
    id: 'car-agent',
    name: 'Car',
    categoryId: 'agents',
    behavior: 'agentic',
    geometry: 'car',
    defaultColor: '#ef4444',
    defaultScale: 1,
    userPlaceable: false,
    behaviorConfig: { agentSpeed: 1.2, pathRadius: 8 },
  }),
]

export const DEFAULT_SANDBOX_SETTINGS: SandboxSettings = {
  placementRules: {
    snapGridEnabled: false,
    snapGridSize: 5,
    zonesEnabled: false,
    maxPropsPerCell: 3,
    densityCellSize: 10,
    densityEnabled: false,
  },
  zones: [],
  userVisibility: {
    showPropToolbar: true,
    showPlacementHints: true,
    showZoneOverlays: false,
    showSnapGrid: false,
    showUndoRedo: false,
  },
  categories: DEFAULT_CATEGORIES,
  propLibrary: DEFAULT_PROP_LIBRARY,
}

export const ADMIN_SESSION_KEY = 'manoel-admin-authenticated'
export const SANDBOX_STORAGE_KEY = 'manoel-sandbox-state'

export function getAdminPassword(): string {
  return import.meta.env.VITE_ADMIN_PASSWORD ?? 'z1z1z1z1'
}
