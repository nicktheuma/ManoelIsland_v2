import { useMemo, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { usePlacementPreview } from '../context/PlacementPreviewContext'

const VALID_FILL = '#22d3ee'
const VALID_RING = '#67e8f9'
const INVALID_FILL = '#ef4444'
const INVALID_RING = '#fca5a5'
const FOOTPRINT_LIFT = 0.15

type PropPreviewOutlineProps = {
  radius: number
}

export function PropPreviewOutline({ radius }: PropPreviewOutlineProps) {
  const { stateRef, subscribe } = usePlacementPreview()
  const preview = useSyncExternalStore(subscribe, () => stateRef.current, () => stateRef.current)

  const ringGeometry = useMemo(() => {
    const inner = Math.max(radius * 0.72, 0.05)
    return new THREE.RingGeometry(inner, radius, 48)
  }, [radius])

  if (!preview.visible) return null

  const [x, y, z] = preview.position
  const fillColor = preview.valid ? VALID_FILL : INVALID_FILL
  const ringColor = preview.valid ? VALID_RING : INVALID_RING

  return (
    <group position={[x, y + FOOTPRINT_LIFT, z]} renderOrder={1000}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial
          color={fillColor}
          transparent
          opacity={preview.valid ? 0.28 : 0.38}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeometry}>
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0.92}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
