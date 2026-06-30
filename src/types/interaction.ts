export type InteractionMode = 'placement' | 'edit'

export const INTERACTION_MODES: { id: InteractionMode; label: string }[] = [
  { id: 'placement', label: 'Place' },
  { id: 'edit', label: 'Edit' },
]

// Future modes: 'construction' | 'demolition'

export function isPlacementMode(mode: InteractionMode): boolean {
  return mode === 'placement'
}

export function isEditMode(mode: InteractionMode): boolean {
  return mode === 'edit'
}
