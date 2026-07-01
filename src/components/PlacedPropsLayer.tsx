import { memo, useMemo, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { useSandbox } from '../context/SandboxProvider'
import { PropRenderer } from './PropRenderer'
import type { PropDefinition } from '../types/propLibrary'
import type { PlacedProp } from '../types/props'
import {
  getRateLimitSecondsRemaining,
  subscribeRateLimitSeconds,
} from '../utils/rateLimitStore'
import {
  getSculptRateLimitSecondsRemaining,
  subscribeSculptRateLimitSeconds,
} from '../utils/sculptRateLimitStore'

type PlacedPropsLayerProps = {
  onSelect?: (id: string) => void
  selectedPropId?: string | null
  selectionEnabled?: boolean
}

type PlacedPropItemProps = {
  prop: PlacedProp
  definition: PropDefinition
  selected: boolean
  hovered: boolean
  selectionEnabled: boolean
  onSelect?: (id: string) => void
  onHover: (id: string | null) => void
}

const PlacedPropItem = memo(function PlacedPropItem({
  prop,
  definition,
  selected,
  hovered,
  selectionEnabled,
  onSelect,
  onHover,
}: PlacedPropItemProps) {
  return (
    <PropRenderer
      prop={prop}
      definition={definition}
      selected={selected}
      hovered={hovered}
      selectable={selectionEnabled}
      behaviorPaused={selectionEnabled}
      onSelect={onSelect}
      onHover={selectionEnabled ? onHover : undefined}
    />
  )
})

export function PlacedPropsLayer({
  onSelect,
  selectedPropId,
  selectionEnabled = false,
}: PlacedPropsLayerProps) {
  const { placedProps, settings } = useSandbox()
  const [hoveredPropId, setHoveredPropId] = useState<string | null>(null)

  const definitionMap = useMemo(
    () => new Map(settings.propLibrary.map((definition) => [definition.id, definition])),
    [settings.propLibrary],
  )

  return (
    <>
      {placedProps.map((prop) => {
        const definition = definitionMap.get(prop.propId)
        if (!definition) return null
        return (
          <PlacedPropItem
            key={prop.id}
            prop={prop}
            definition={definition}
            selected={selectedPropId === prop.id}
            hovered={selectionEnabled && hoveredPropId === prop.id && selectedPropId !== prop.id}
            selectionEnabled={selectionEnabled}
            onSelect={onSelect}
            onHover={setHoveredPropId}
          />
        )
      })}
    </>
  )
}

export function RateLimitOverlay() {
  const secondsRemaining = useSyncExternalStore(
    subscribeRateLimitSeconds,
    getRateLimitSecondsRemaining,
    () => 0,
  )

  if (secondsRemaining <= 0) return null

  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60

  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
      <div className="rounded-lg border border-amber-500/40 bg-slate-900/90 px-4 py-2 text-center text-sm text-amber-100 shadow-lg backdrop-blur">
        <p className="font-medium">Rate limit active</p>
        <p className="text-amber-200/80">
          Next placement in {minutes}:{seconds.toString().padStart(2, '0')}
        </p>
      </div>
    </div>
  )
}

export function SculptRateLimitOverlay() {
  const secondsRemaining = useSyncExternalStore(
    subscribeSculptRateLimitSeconds,
    getSculptRateLimitSecondsRemaining,
    () => 0,
  )

  if (secondsRemaining <= 0) return null

  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60

  return (
    <div className="pointer-events-none absolute bottom-36 left-1/2 z-20 -translate-x-1/2">
      <div className="rounded-lg border border-orange-500/40 bg-slate-900/90 px-4 py-2 text-center text-sm text-orange-100 shadow-lg backdrop-blur">
        <p className="font-medium">Terrain sculpt limit active</p>
        <p className="text-orange-200/80">
          Next excavation or fill in {minutes}:{seconds.toString().padStart(2, '0')}
        </p>
      </div>
    </div>
  )
}
