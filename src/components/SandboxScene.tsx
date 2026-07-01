import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { isHdriPreset, normalizeSceneAppearance } from '../config/sceneAppearance'
import { AdminLoginModal } from './admin/AdminLoginModal'
import { AdminPanel } from './admin/AdminPanel'
import { CustomTerrain } from './CustomTerrain'
import { AnimatedWater } from './AnimatedWater'
import { SceneFog } from './SceneFog'
import { PlacedPropsLayer } from './PlacedPropsLayer'
import { PropPreviewOutline } from './PropPreviewOutline'
import { PropEditPanel } from './PropEditPanel'
import { PropToolbar } from './PropToolbar'
import { SnapGridOverlay } from './SnapGridOverlay'
import { ZoneOverlays } from './ZoneOverlays'
import { propPositionFromPoint } from './PropRenderer'
import { useAdmin } from '../context/AdminProvider'
import { useSandbox } from '../context/SandboxProvider'
import { PlacementPreviewProvider, usePlacementPreview } from '../context/PlacementPreviewContext'
import { TerrainHeightProvider, useTerrainHeight } from '../context/TerrainHeightProvider'
import { previewPlacementPosition, getUserPlaceableProps } from '../utils/placementRules'
import { isCoarsePointerDevice } from '../utils/pointer'
import { RateLimitOverlay } from './PlacedPropsLayer'
import { TerrainHeightmapProvider } from '../context/TerrainHeightmapProvider'
import { SandboxOrbitControls } from './SceneCamera'
import { useAdminShortcut } from '../hooks/useAdminShortcut'
import { useSandboxShortcuts } from '../hooks/useSandboxShortcuts'
import { isEditMode, isPlacementMode, type InteractionMode } from '../types/interaction'

type SandboxCanvasProps = {
  mode: InteractionMode
  previewRadius: number
  orbitEnabled: boolean
  onPreviewChange: (position: [number, number, number] | null) => void
  onPreviewValidChange: (valid: boolean) => void
  onPlaceConfirm: (point?: THREE.Vector3) => void
  onTouchPlacementStart: () => void
  onTouchPlacementEnd: () => void
}

function PreviewPlacementSync({
  onPreviewChange,
  onPreviewValidChange,
}: {
  onPreviewChange: (position: [number, number, number] | null) => void
  onPreviewValidChange: (valid: boolean) => void
}) {
  const { stateRef, subscribe } = usePlacementPreview()

  useEffect(
    () =>
      subscribe(() => {
        const current = stateRef.current
        onPreviewChange(current.visible ? current.position : null)
        onPreviewValidChange(current.visible ? current.valid : false)
      }),
    [onPreviewChange, onPreviewValidChange, stateRef, subscribe],
  )

  return null
}

function SceneLighting({ hdriPreset }: { hdriPreset: string }) {
  const useHdri = isHdriPreset(hdriPreset)

  return (
    <>
      <ambientLight intensity={useHdri ? 0.25 : 0.45} />
      <directionalLight position={[60, 80, 40]} intensity={useHdri ? 0.8 : 1.2} castShadow />
      {useHdri && (
        <Suspense fallback={null}>
          <Environment key={hdriPreset} preset={hdriPreset} background={false} />
        </Suspense>
      )}
    </>
  )
}

function SandboxCanvas({
  mode,
  previewRadius,
  orbitEnabled,
  onPreviewChange,
  onPreviewValidChange,
  onPlaceConfirm,
  onTouchPlacementStart,
  onTouchPlacementEnd,
}: SandboxCanvasProps) {
  const { selectedPropId, selectProp, settings } = useSandbox()
  const { zoneDrawingMode, addDraftZonePoint } = useAdmin()
  const { setPreview, getPreview } = usePlacementPreview()
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const { getHeightAt } = useTerrainHeight()

  const sceneAppearance = normalizeSceneAppearance(settings.sceneAppearance)
  const { backgroundColor, hdriPreset, camera } = sceneAppearance

  const placementMode = isPlacementMode(mode)
  const editMode = isEditMode(mode)

  const handlePreviewMove = useCallback(
    (point: THREE.Vector3, valid: boolean) => {
      if (!isPlacementMode(mode)) return
      const raw = propPositionFromPoint(point)
      const { water } = normalizeSceneAppearance(settingsRef.current.sceneAppearance)

      if (!valid) {
        setPreview([raw[0], water.level, raw[2]], false)
        return
      }

      const snapped = previewPlacementPosition(raw, settingsRef.current, getHeightAt)
      setPreview(snapped, true)
    },
    [getHeightAt, mode, setPreview],
  )

  const handlePreviewLeave = useCallback(() => {
    // Intentionally no-op: leaving terrain for water should keep the ghost updating via the water plane.
  }, [])

  const handlePlaceConfirm = useCallback(
    (point?: THREE.Vector3) => {
      if (point) {
        onPlaceConfirm(point)
        return
      }

      const preview = getPreview()
      if (!preview?.valid) return
      onPlaceConfirm(new THREE.Vector3(preview.position[0], preview.position[1], preview.position[2]))
    },
    [getPreview, onPlaceConfirm],
  )

  const handleZonePoint = useCallback(
    (x: number, z: number) => addDraftZonePoint([x, z]),
    [addDraftZonePoint],
  )

  return (
    <>
      <PreviewPlacementSync onPreviewChange={onPreviewChange} onPreviewValidChange={onPreviewValidChange} />
      <color attach="background" args={[backgroundColor]} />

      <SceneFog />
      <SceneLighting hdriPreset={hdriPreset} />

      <AnimatedWater
        placementPreviewEnabled={placementMode && !zoneDrawingMode}
        onPreviewMove={handlePreviewMove}
      />

      <Suspense fallback={null}>
        <CustomTerrain
          zoneDrawingMode={zoneDrawingMode}
          placementEnabled={placementMode && !zoneDrawingMode}
          editMode={editMode && !zoneDrawingMode}
          onPreviewMove={handlePreviewMove}
          onPreviewLeave={handlePreviewLeave}
          onPlaceConfirm={handlePlaceConfirm}
          onEditModeTerrainClick={() => selectProp(null)}
          onZonePoint={handleZonePoint}
          onTouchPlacementStart={onTouchPlacementStart}
          onTouchPlacementEnd={onTouchPlacementEnd}
        />
      </Suspense>

      <SnapGridOverlay />
      <ZoneOverlays />

      {placementMode && !zoneDrawingMode && <PropPreviewOutline radius={previewRadius} />}

      <PlacedPropsLayer
        selectedPropId={selectedPropId}
        onSelect={selectProp}
        selectionEnabled={editMode}
      />

      <SandboxOrbitControls camera={camera} enabled={orbitEnabled} />
    </>
  )
}

function SandboxCanvasRoot(props: SandboxCanvasProps) {
  return (
    <TerrainHeightProvider>
      <SandboxCanvas {...props} />
    </TerrainHeightProvider>
  )
}

function SandboxExperience() {
  const { settings, placeProp, getPropDefinition, selectProp, clearPlacementError, isMultiplayerLoading } =
    useSandbox()
  const { setPreview } = usePlacementPreview()
  const sceneAppearance = normalizeSceneAppearance(settings.sceneAppearance)
  const isTouchDevice = useMemo(() => isCoarsePointerDevice(), [])

  const placeableProps = useMemo(() => getUserPlaceableProps(settings), [settings])
  const [mode, setMode] = useState<InteractionMode>('placement')
  const [selectedLibraryPropId, setSelectedLibraryPropId] = useState(
    () => placeableProps[0]?.id ?? settings.propLibrary[0]?.id ?? 'tree-oak',
  )
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const [hasPreview, setHasPreview] = useState(false)
  const previewPositionRef = useRef<[number, number, number] | null>(null)
  const previewValidRef = useRef(true)

  const handlePreviewChange = useCallback((position: [number, number, number] | null) => {
    previewPositionRef.current = position
    setHasPreview((previous) => {
      const next = position !== null
      return previous === next ? previous : next
    })
  }, [])

  const handlePreviewValidChange = useCallback((valid: boolean) => {
    previewValidRef.current = valid
  }, [])

  useAdminShortcut()
  useSandboxShortcuts()

  const selectedDefinition = getPropDefinition(selectedLibraryPropId)
  const previewRadius = (selectedDefinition?.placement.colliderRadius ?? 1.5) * (selectedDefinition?.defaultScale ?? 1)

  const handleModeChange = useCallback(
    (nextMode: InteractionMode) => {
      setMode(nextMode)
      setHasPreview(false)
      clearPlacementError()
      selectProp(null)
    },
    [clearPlacementError, selectProp],
  )

  const handlePlaceConfirm = useCallback(
    async (point?: THREE.Vector3) => {
      if (!isPlacementMode(mode)) return

      const position = point ? propPositionFromPoint(point) : previewPositionRef.current
      if (!position || !previewValidRef.current) return

      const placed = await placeProp(selectedLibraryPropId, position)
      if (!placed) return

      if (!isTouchDevice) setHasPreview(false)
    },
    [isTouchDevice, mode, placeProp, selectedLibraryPropId],
  )

  return (
    <div className="relative h-screen w-screen bg-slate-950">
      <Canvas
        camera={{
          position: sceneAppearance.camera.position,
          fov: sceneAppearance.camera.fov,
          near: 0.1,
          far: 500,
        }}
        onPointerMissed={() => {
          if (isPlacementMode(mode)) setPreview(null)
        }}
        gl={{ antialias: true }}
      >
        <SandboxCanvasRoot
          mode={mode}
          previewRadius={previewRadius}
          orbitEnabled={orbitEnabled}
          onPreviewChange={handlePreviewChange}
          onPreviewValidChange={handlePreviewValidChange}
          onPlaceConfirm={handlePlaceConfirm}
          onTouchPlacementStart={() => setOrbitEnabled(false)}
          onTouchPlacementEnd={() => setOrbitEnabled(true)}
        />
      </Canvas>

      <PropToolbar
        mode={mode}
        onModeChange={handleModeChange}
        selectedPropId={selectedLibraryPropId}
        onSelectProp={setSelectedLibraryPropId}
        isTouchDevice={isTouchDevice}
        hasPreview={hasPreview}
        onPlaceConfirm={() => handlePlaceConfirm()}
      />

      <PropEditPanel mode={mode} />
      <RateLimitOverlay />
      {isMultiplayerLoading && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
          <div className="rounded bg-slate-900/80 px-3 py-1 text-xs text-slate-300 backdrop-blur">
            Syncing island…
          </div>
        </div>
      )}
      <AdminPanel />
      <AdminLoginModal />
    </div>
  )
}

export function SandboxScene() {
  return (
    <TerrainHeightmapProvider>
      <PlacementPreviewProvider>
        <SandboxExperience />
      </PlacementPreviewProvider>
    </TerrainHeightmapProvider>
  )
}
