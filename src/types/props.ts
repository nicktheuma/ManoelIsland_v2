export type PropType = 'tree' | 'bench' | 'pavilion'

export type PlacedProp = {
  id: string
  type: PropType
  position: [number, number, number]
}
