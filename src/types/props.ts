export type PlacedProp = {
  id: string
  propId: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  color: string
  metadata: Record<string, unknown>
  createdAt: string
  isLocked?: boolean
}

export function createPlacedProp(
  propId: string,
  position: [number, number, number],
  defaults: { color: string; scale: number },
  overrides?: Partial<Pick<PlacedProp, 'rotation' | 'scale' | 'color' | 'metadata'>>,
): PlacedProp {
  return {
    id: crypto.randomUUID(),
    propId,
    position,
    rotation: overrides?.rotation ?? [0, 0, 0],
    scale: overrides?.scale ?? defaults.scale,
    color: overrides?.color ?? defaults.color,
    metadata: overrides?.metadata ?? {},
    createdAt: new Date().toISOString(),
  }
}
