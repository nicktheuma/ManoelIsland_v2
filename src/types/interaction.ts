export type InteractionMode = 'placement' | 'edit' | 'excavate' | 'fill'

export const INTERACTION_MODES: { id: InteractionMode; label: string }[] = [
  { id: 'placement', label: 'Place' },
  { id: 'edit', label: 'Edit' },
  { id: 'excavate', label: 'Excavate' },
  { id: 'fill', label: 'Fill' },
]

export function isPlacementMode(mode: InteractionMode): boolean {
  return mode === 'placement'
}

export function isEditMode(mode: InteractionMode): boolean {
  return mode === 'edit'
}

export function isSculptMode(mode: InteractionMode): boolean {
  return mode === 'excavate' || mode === 'fill'
}

export function sculptToolFromMode(mode: InteractionMode): 'excavate' | 'fill' | null {
  if (mode === 'excavate') return 'excavate'
  if (mode === 'fill') return 'fill'
  return null
}

export function visibleInteractionModes(showSculptTools: boolean): InteractionMode[] {
  return INTERACTION_MODES.filter(({ id }) => showSculptTools || !isSculptMode(id)).map(({ id }) => id)
}
