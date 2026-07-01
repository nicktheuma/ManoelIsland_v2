import { useMemo, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useTerrainSculpt } from '../context/TerrainSculptProvider'
import type { SculptTool } from '../utils/terrainSculpt'

const EXCAVATE_FILL = '#f59e0b'
const EXCAVATE_RING = '#fbbf24'
const FILL_FILL = '#34d399'
const FILL_RING = '#6ee7b7'

type SculptBrushPreviewProps = {
  tool: SculptTool
}

export function SculptBrushPreview({ tool }: SculptBrushPreviewProps) {
  const { brush, brushPreviewRef, subscribeBrushPreview } = useTerrainSculpt()
  const preview = useSyncExternalStore(subscribeBrushPreview, () => brushPreviewRef.current, () => null)

  const ringGeometry = useMemo(() => {
    const inner = Math.max(brush.radius * 0.85, 0.05)
    return new THREE.RingGeometry(inner, brush.radius, 48)
  }, [brush.radius])

  if (!preview) return null

  const fillColor = tool === 'excavate' ? EXCAVATE_FILL : FILL_FILL
  const ringColor = tool === 'excavate' ? EXCAVATE_RING : FILL_RING

  return (
    <group position={preview} renderOrder={1000}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[brush.radius, 48]} />
        <meshBasicMaterial
          color={fillColor}
          transparent
          opacity={0.22}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeometry}>
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={0.88}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
