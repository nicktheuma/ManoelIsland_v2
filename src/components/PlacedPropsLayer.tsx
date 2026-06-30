import { useState } from 'react'
import { useSandbox } from '../context/SandboxProvider'
import { PropRenderer } from './PropRenderer'
import type { PlacedProp } from '../types/props'

type PlacedPropsLayerProps = {
  onSelect?: (id: string) => void
  selectedPropId?: string | null
  selectionEnabled?: boolean
}

export function PlacedPropsLayer({
  onSelect,
  selectedPropId,
  selectionEnabled = false,
}: PlacedPropsLayerProps) {
  const { placedProps, getPropDefinition } = useSandbox()
  const [hoveredPropId, setHoveredPropId] = useState<string | null>(null)

  return (
    <>
      {placedProps.map((prop) => {
        const definition = getPropDefinition(prop.propId)
        if (!definition) return null
        return (
          <PropRenderer
            key={prop.id}
            prop={prop}
            definition={definition}
            selected={selectedPropId === prop.id}
            hovered={selectionEnabled && hoveredPropId === prop.id && selectedPropId !== prop.id}
            selectable={selectionEnabled}
            behaviorPaused={selectionEnabled}
            onSelect={onSelect}
            onHover={selectionEnabled ? setHoveredPropId : undefined}
          />
        )
      })}
    </>
  )
}

type PropPreviewProps = {
  prop: Pick<PlacedProp, 'propId' | 'position' | 'rotation' | 'scale' | 'color'>
}

export function PropPreviewLayer({ prop }: PropPreviewProps) {
  const { getPropDefinition } = useSandbox()
  const definition = getPropDefinition(prop.propId)
  if (!definition) return null

  return (
    <PropRenderer
      prop={{
        ...prop,
        id: 'preview',
        metadata: {},
        createdAt: '',
      }}
      definition={definition}
      preview
    />
  )
}
