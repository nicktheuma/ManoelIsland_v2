import type * as THREE from 'three'
import type { PropType } from '../types/props'

const PROP_COLORS: Record<PropType, string> = {
  tree: '#22863a',
  bench: '#8b4513',
  pavilion: '#94a3b8',
}

type PropMeshProps = {
  type: PropType
  position: [number, number, number]
  preview?: boolean
}

export function PropMesh({ type, position, preview = false }: PropMeshProps) {
  const [x, y, z] = position
  const color = PROP_COLORS[type]

  const material = (
    <meshStandardMaterial
      color={color}
      transparent={preview}
      opacity={preview ? 0.5 : 1}
      depthWrite={!preview}
      emissive={preview ? color : '#000000'}
      emissiveIntensity={preview ? 0.35 : 0}
    />
  )

  if (type === 'tree') {
    return (
      <mesh position={[x, y + 1.5, z]}>
        <cylinderGeometry args={[0.6, 0.8, 3, 8]} />
        {material}
      </mesh>
    )
  }

  if (type === 'bench') {
    return (
      <mesh position={[x, y + 0.3, z]}>
        <boxGeometry args={[2, 0.6, 0.8]} />
        {material}
      </mesh>
    )
  }

  return (
    <mesh position={[x, y + 1.2, z]}>
      <capsuleGeometry args={[1.2, 2.4, 4, 12]} />
      {material}
    </mesh>
  )
}

export function propPositionFromPoint(point: THREE.Vector3): [number, number, number] {
  return [point.x, point.y, point.z]
}
