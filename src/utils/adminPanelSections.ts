export const ADMIN_PANEL_SECTIONS = [
  'sceneAppearance',
  'terrain',
  'fog',
  'water',
  'historyControls',
  'mapOperations',
  'placementRules',
  'rateLimits',
  'allowedZones',
  'propLibrary',
] as const

export type AdminPanelSectionId = (typeof ADMIN_PANEL_SECTIONS)[number]

export type AdminPanelSectionState = Record<AdminPanelSectionId, boolean>

const SECTIONS_STORAGE_KEY = 'manoel-admin-panel-sections'
const SCROLL_STORAGE_KEY = 'manoel-admin-panel-scroll'

function defaultSectionState(): AdminPanelSectionState {
  return Object.fromEntries(
    ADMIN_PANEL_SECTIONS.map((id) => [id, false]),
  ) as AdminPanelSectionState
}

export function loadAdminPanelSections(): AdminPanelSectionState {
  try {
    const raw = sessionStorage.getItem(SECTIONS_STORAGE_KEY)
    if (!raw) return defaultSectionState()

    const parsed = JSON.parse(raw) as Partial<AdminPanelSectionState>
    return { ...defaultSectionState(), ...parsed }
  } catch {
    return defaultSectionState()
  }
}

export function saveAdminPanelSections(state: AdminPanelSectionState): void {
  sessionStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(state))
}

export function loadAdminPanelScroll(): number {
  try {
    const raw = sessionStorage.getItem(SCROLL_STORAGE_KEY)
    if (!raw) return 0
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? value : 0
  } catch {
    return 0
  }
}

export function saveAdminPanelScroll(scrollTop: number): void {
  sessionStorage.setItem(SCROLL_STORAGE_KEY, String(Math.max(0, scrollTop)))
}
