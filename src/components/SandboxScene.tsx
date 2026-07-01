import { Suspense, useCallback, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { isHdriPreset, normalizeSceneAppearance } from '../config/sceneAppearance'
import { AdminLoginModal } from './admin/AdminLoginModal'
import { AdminPanel } from './admin/AdminPanel'
import { CustomTerrain } from './CustomTerrain'
import { AnimatedWater } from './AnimatedWater'
import { SceneFog } from './SceneFog'
import { PlacedPropsLayer, PropPreviewLayer } from './PlacedPropsLayer'
import { PropEditPanel } from './PropEditPanel'
import { PropToolbar } from './PropToolbar'
import { SnapGridOverlay } from './SnapGridOverlay'
import { ZoneOverlays } from './ZoneOverlays'
import { propPositionFromPoint } from './PropRenderer'
import { useAdmin } from '../context/AdminProvider'
import { useSandbox } from '../context/SandboxProvider'
import { TerrainHeightProvider, useTerrainHeight } from '../context/TerrainHeightProvider'
import { previewPlacementPosition, getUserPlaceableProps } from '../utils/placementRules'
import { isCoarsePointerDevice } from '../utils/pointer'
import { RateLimitOverlay } from './RateLimitOverlay'
import { TerrainHeightmapProvider } from '../context/TerrainHeightmapProvider'
import { useAdminShortcut } from '../hooks/useAdminShortcut'
import { useSandboxShortcuts } from '../hooks/useSandboxShortcuts'
import { isEditMode, isPlacementMode, type InteractionMode } from '../types/interaction'

type SandboxCanvasProps = {
  mode: InteractionMode
  selectedLibraryPropId: string
  previewPosition: [number, number, number] | null
  previewRotation: [number, number, number]
  previewScale: number
  previewColor: string
  orbitEnabled: boolean
  onPreviewMove: (position: [number, number, number]) => void
  onPreviewLeave: () => void
  onPlaceConfirm: (point?: THREE.Vector3) => void
  onTouchPlacementStart: () => void
  onTouchPlacementEnd: () => void
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
  selectedLibraryPropId,
  previewPosition,
  previewRotation,
  previewScale,
  previewColor,
  orbitEnabled,
  onPreviewMove,
  onPreviewLeave,
  onPlaceConfirm,
  onTouchPlacementStart,
  onTouchPlacementEnd,
}: SandboxCanvasProps) {
  const { selectedPropId, selectProp, settings } = useSandbox()
  const { zoneDrawingMode, addDraftZonePoint } = useAdmin()
  const { backgroundColor, hdriPreset } = normalizeSceneAppearance(settings.sceneAppearance)

  const placementMode = isPlacementMode(mode)
  const editMode = isEditMode(mode)

  const handlePreviewMove = useCallback(
    (point: THREE.Vector3) => {
      onPreviewMove(propPositionFromPoint(point))
    },
    [onPreviewMove],
  )

  const handleZonePoint = useCallback(
    (x: number, z: number) => addDraftZonePoint([x, z]),
    [addDraftZonePoint],
  )

  return (
    <>
      <color attach="background" args={[backgroundColor]} />

      <SceneFog />
      <SceneLighting hdriPreset={hdriPreset} />

      <AnimatedWater />

      <Suspense fallback={null}>
        <CustomTerrain
          hasPreview={previewPosition !== null}
          zoneDrawingMode={zoneDrawingMode}
          placementEnabled={placementMode && !zoneDrawingMode}
          editMode={editMode && !zoneDrawingMode}
          onPreviewMove={handlePreviewMove}
          onPreviewLeave={onPreviewLeave}
          onPlaceConfirm={onPlaceConfirm}
          onEditModeTerrainClick={() => selectProp(null)}
          onZonePoint={handleZonePoint}
          onTouchPlacementStart={onTouchPlacementStart}
          onTouchPlacementEnd={onTouchPlacementEnd}
        />
      </Suspense>

      <SnapGridOverlay />
      <ZoneOverlays />

      {placementMode && previewPosition && !zoneDrawingMode && (
        <PropPreviewLayer
          prop={{
            propId: selectedLibraryPropId,
            position: previewPosition,
            rotation: previewRotation,
            scale: previewScale,
            color: previewColor,
          }}
        />
      )}

      <PlacedPropsLayer
        selectedPropId={selectedPropId}
        onSelect={selectProp}
        selectionEnabled={editMode}
      />

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

function PreviewSnapBridge(
  props: Omit<SandboxCanvasProps, 'onPreviewMove'> & {
    onPreviewMoveExternal: (position: [number, number, number]) => void
  },
) {
  const { settings } = useSandbox()
  const { getHeightAt } = useTerrainHeight()
  const { onPreviewMoveExternal, mode, ...canvasProps } = props

  const handlePreviewMove = useCallback(
    (position: [number, number, number]) => {
      if (!isPlacementMode(mode)) return
      onPreviewMoveExternal(previewPlacementPosition(position, settings, getHeightAt))
    },
    [getHeightAt, mode, onPreviewMoveExternal, settings],
  )

  return <SandboxCanvas {...canvasProps} mode={mode} onPreviewMove={handlePreviewMove} />
}

function SandboxCanvasRoot(
  props: Omit<SandboxCanvasProps, 'onPreviewMove'> & {
    onPreviewMoveExternal: (position: [number, number, number]) => void
  },
) {
  return (
    <TerrainHeightProvider>
      <PreviewSnapBridge {...props} />
    </TerrainHeightProvider>
  )
}

function SandboxExperience() {
  const {
    settings,
    placeProp,
    getPropDefinition,
    selectProp,
    clearPlacementError,
    rateLimitSecondsRemaining,
    isMultiplayerLoading,
  } = useSandbox()
  const isTouchDevice = useMemo(() => isCoarsePointerDevice(), [])

  const placeableProps = useMemo(() => getUserPlaceableProps(settings), [settings])
  const [mode, setMode] = useState<InteractionMode>('placement')
  const [selectedLibraryPropId, setSelectedLibraryPropId] = useState(
    () => placeableProps[0]?.id ?? settings.propLibrary[0]?.id ?? 'tree-oak',
  )
  const [previewPosition, setPreviewPosition] = useState<[number, number, number] | null>(null)
  const [orbitEnabled, setOrbitEnabled] = useState(true)

  useAdminShortcut()
  useSandboxShortcuts()

  const selectedDefinition = getPropDefinition(selectedLibraryPropId)

  const handleModeChange = useCallback(
    (nextMode: InteractionMode) => {
      setMode(nextMode)
      setPreviewPosition(null)
      clearPlacementError()
      selectProp(null)
    },
    [clearPlacementError, selectProp],
  )

  const handlePreviewLeave = useCallback(() => {
    if (!isTouchDevice) setPreviewPosition(null)
  }, [isTouchDevice])

  const handlePlaceConfirm = useCallback(
    async (point?: THREE.Vector3) => {
      if (!isPlacementMode(mode)) return

      const position = point ? propPositionFromPoint(point) : previewPosition
      if (!position) return

      const placed = await placeProp(selectedLibraryPropId, position)
      if (!placed) return

      if (!isTouchDevice) setPreviewPosition(null)
    },
    [isTouchDevice, mode, placeProp, previewPosition, selectedLibraryPropId],
  )

  return (
    <div className="relative h-screen w-screen bg-slate-950">
      <Canvas
        camera={{ position: [80, 60, 80], fov: 50, near: 0.1, far: 500 }}
        gl={{ antialias: true }}
      >
        <SandboxCanvasRoot
          mode={mode}
          selectedLibraryPropId={selectedLibraryPropId}
          previewPosition={previewPosition}
          previewRotation={[0, 0, 0]}
          previewScale={selectedDefinition?.defaultScale ?? 1}
          previewColor={selectedDefinition?.defaultColor ?? '#ffffff'}
          orbitEnabled={orbitEnabled}
          onPreviewMoveExternal={setPreviewPosition}
          onPreviewLeave={handlePreviewLeave}
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
        hasPreview={previewPosition !== null}
        onPlaceConfirm={() => handlePlaceConfirm()}
      />

      <PropEditPanel mode={mode} />
      <RateLimitOverlay secondsRemaining={rateLimitSecondsRemaining} />
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
      <SandboxExperience />
    </TerrainHeightmapProvider>
  )
}
