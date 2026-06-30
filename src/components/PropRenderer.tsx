import { useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { PropDefinition } from '../types/propLibrary'
import type { PlacedProp } from '../types/props'

type PropRendererProps = {
  prop: PlacedProp
  definition: PropDefinition
  preview?: boolean
  selected?: boolean
  hovered?: boolean
  selectable?: boolean
  behaviorPaused?: boolean
  onSelect?: (id: string) => void
  onHover?: (id: string | null) => void
}

function PropMaterial({
  color,
  preview,
  selected,
  hovered,
}: {
  color: string
  preview?: boolean
  selected?: boolean
  hovered?: boolean
}) {
  const highlighted = preview || selected || hovered
  const emissiveIntensity = preview ? 0.35 : selected ? 0.28 : hovered ? 0.18 : 0

  return (
    <meshStandardMaterial
      color={color}
      transparent={preview}
      opacity={preview ? 0.5 : 1}
      depthWrite={!preview}
      emissive={highlighted ? color : '#000000'}
      emissiveIntensity={emissiveIntensity}
    />
  )
}

function GeometryMesh({
  geometry,
  color,
  preview,
  selected,
  hovered,
}: {
  geometry: PropDefinition['geometry']
  color: string
  preview?: boolean
  selected?: boolean
  hovered?: boolean
}) {
  const material = (
    <PropMaterial color={color} preview={preview} selected={selected} hovered={hovered} />
  )

  switch (geometry) {
    case 'tree':
      return (
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.6, 0.8, 3, 8]} />
          {material}
        </mesh>
      )
    case 'bench':
      return (
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[2, 0.6, 0.8]} />
          {material}
        </mesh>
      )
    case 'pavilion':
      return (
        <mesh position={[0, 1.2, 0]}>
          <capsuleGeometry args={[1.2, 2.4, 4, 12]} />
          {material}
        </mesh>
      )
    case 'car':
      return (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[2.2, 0.8, 1.2]} />
          {material}
        </mesh>
      )
    case 'person':
      return (
        <mesh position={[0, 0.9, 0]}>
          <capsuleGeometry args={[0.35, 1.2, 4, 8]} />
          {material}
        </mesh>
      )
    case 'cylinder':
      return (
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 1.5, 12]} />
          {material}
        </mesh>
      )
    case 'capsule':
      return (
        <mesh position={[0, 0.9, 0]}>
          <capsuleGeometry args={[0.5, 1.2, 4, 10]} />
          {material}
        </mesh>
      )
    default:
      return (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          {material}
        </mesh>
      )
  }
}

function AnimatedBehavior({
  children,
  speed = 1,
}: {
  children: ReactNode
  speed?: number
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.rotation.y += delta * speed
    groupRef.current.position.y = Math.sin(performance.now() * 0.002 * speed) * 0.15
  })

  return <group ref={groupRef}>{children}</group>
}

function TemporalBehavior({
  children,
  durationDays = 7,
}: {
  children: ReactNode
  durationDays?: number
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!groupRef.current) return
    const cycleMs = durationDays * 24 * 60 * 60 * 1000
    const progress = (performance.now() % cycleMs) / cycleMs
    const scale = 0.6 + progress * 0.8
    groupRef.current.scale.setScalar(scale)
  })

  return <group ref={groupRef}>{children}</group>
}

function AgenticBehavior({
  children,
  speed = 1,
  radius = 4,
  basePosition,
}: {
  children: ReactNode
  speed?: number
  radius?: number
  basePosition: [number, number, number]
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime() * speed
    groupRef.current.position.x = basePosition[0] + Math.cos(t) * radius
    groupRef.current.position.z = basePosition[2] + Math.sin(t) * radius
    groupRef.current.rotation.y = -t
  })

  return <group ref={groupRef}>{children}</group>
}

export function PropRenderer({
  prop,
  definition,
  preview = false,
  selected = false,
  hovered = false,
  selectable = false,
  behaviorPaused = false,
  onSelect,
  onHover,
}: PropRendererProps) {
  const [x, y, z] = prop.position
  const [rx, ry, rz] = prop.rotation

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!selectable || preview) return
    event.stopPropagation()
  }

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    if (!selectable || preview) return
    event.stopPropagation()
    onHover?.(prop.id)
  }

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    if (!selectable || preview) return
    event.stopPropagation()
    onHover?.(null)
  }

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (preview || !selectable || !onSelect) return
    event.stopPropagation()
    onSelect(prop.id)
  }

  const geometry = (
    <GeometryMesh
      geometry={definition.geometry}
      color={prop.color}
      preview={preview}
      selected={selected}
      hovered={hovered}
    />
  )

  let content: ReactNode = geometry

  if (!preview && !behaviorPaused) {
    switch (definition.behavior) {
      case 'animated':
        content = (
          <AnimatedBehavior speed={definition.behaviorConfig?.animationSpeed ?? 1}>
            {geometry}
          </AnimatedBehavior>
        )
        break
      case 'temporal':
        content = (
          <TemporalBehavior durationDays={definition.behaviorConfig?.durationDays ?? 7}>
            {geometry}
          </TemporalBehavior>
        )
        break
      case 'agentic':
        content = (
          <AgenticBehavior
            speed={definition.behaviorConfig?.agentSpeed ?? 1}
            radius={definition.behaviorConfig?.pathRadius ?? 4}
            basePosition={prop.position}
          >
            {geometry}
          </AgenticBehavior>
        )
        break
      default:
        content = geometry
    }
  }

  return (
    <group
      position={[x, y, z]}
      rotation={[rx, ry, rz]}
      scale={[prop.scale, prop.scale, prop.scale]}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {content}
    </group>
  )
}

export function propPositionFromPoint(point: THREE.Vector3): [number, number, number] {
  return [point.x, point.y, point.z]
}
