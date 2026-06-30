import { Suspense, useCallback, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { CustomTerrain } from './CustomTerrain'
import { PlacedProps } from './PlacedProps'
import { PropPreview } from './PropPreview'
import { PropToolbar } from './PropToolbar'
import { propPositionFromPoint } from './PropMesh'
import type { PlacedProp, PropType } from '../types/props'
import { isCoarsePointerDevice } from '../utils/pointer'

type SandboxCanvasProps = {
  placedProps: PlacedProp[]
  selectedType: PropType
  previewPosition: [number, number, number] | null
  orbitEnabled: boolean
  onPreviewMove: (point: THREE.Vector3) => void
  onPreviewLeave: () => void
  onPlaceConfirm: (point?: THREE.Vector3) => void
  onTouchPlacementStart: () => void
  onTouchPlacementEnd: () => void
}

function SandboxCanvas({
  placedProps,
  selectedType,
  previewPosition,
  orbitEnabled,
  onPreviewMove,
  onPreviewLeave,
  onPlaceConfirm,
  onTouchPlacementStart,
  onTouchPlacementEnd,
}: SandboxCanvasProps) {
  return (
    <>
      <color attach="background" args={['#0c1222']} />

      <ambientLight intensity={0.45} />
      <directionalLight position={[60, 80, 40]} intensity={1.2} castShadow />

      <Suspense fallback={null}>
        <CustomTerrain
          hasPreview={previewPosition !== null}
          onPreviewMove={onPreviewMove}
          onPreviewLeave={onPreviewLeave}
          onPlaceConfirm={onPlaceConfirm}
          onTouchPlacementStart={onTouchPlacementStart}
          onTouchPlacementEnd={onTouchPlacementEnd}
        />
      </Suspense>

      {previewPosition && <PropPreview type={selectedType} position={previewPosition} />}

      <PlacedProps placedProps={placedProps} />

      <OrbitControls
        makeDefault
        enabled={orbitEnabled}
        minDistance={25}
        maxDistance={180}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 0, 0]}
      />
    </>
  )
}

export function SandboxScene() {
  const [placedProps, setPlacedProps] = useState<PlacedProp[]>([])
  const [selectedType, setSelectedType] = useState<PropType>('tree')
  const [previewPosition, setPreviewPosition] = useState<[number, number, number] | null>(null)
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const isTouchDevice = useMemo(() => isCoarsePointerDevice(), [])

  const handlePreviewMove = useCallback((point: THREE.Vector3) => {
    setPreviewPosition(propPositionFromPoint(point))
  }, [])

  const handlePreviewLeave = useCallback(() => {
    if (!isTouchDevice) {
      setPreviewPosition(null)
    }
  }, [isTouchDevice])

  const handlePlaceConfirm = useCallback(
    (point?: THREE.Vector3) => {
      const position = point ? propPositionFromPoint(point) : previewPosition
      if (!position) return

      setPlacedProps((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: selectedType,
          position,
        },
      ])

      if (!isTouchDevice) {
        setPreviewPosition(null)
      }
    },
    [isTouchDevice, previewPosition, selectedType],
  )

  const handleTouchPlacementStart = useCallback(() => {
    setOrbitEnabled(false)
  }, [])

  const handleTouchPlacementEnd = useCallback(() => {
    setOrbitEnabled(true)
  }, [])

  return (
    <div className="relative h-screen w-screen bg-slate-950">
      <Canvas
        camera={{ position: [80, 60, 80], fov: 50, near: 0.1, far: 500 }}
        gl={{ antialias: true }}
      >
        <SandboxCanvas
          placedProps={placedProps}
          selectedType={selectedType}
          previewPosition={previewPosition}
          orbitEnabled={orbitEnabled}
          onPreviewMove={handlePreviewMove}
          onPreviewLeave={handlePreviewLeave}
          onPlaceConfirm={handlePlaceConfirm}
          onTouchPlacementStart={handleTouchPlacementStart}
          onTouchPlacementEnd={handleTouchPlacementEnd}
        />
      </Canvas>

      <PropToolbar
        selectedType={selectedType}
        onSelectType={setSelectedType}
        placedCount={placedProps.length}
        isTouchDevice={isTouchDevice}
        hasPreview={previewPosition !== null}
        onPlaceConfirm={handlePlaceConfirm}
      />
    </div>
  )
}
