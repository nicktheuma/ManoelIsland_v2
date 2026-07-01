import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { isHdriPreset, sceneAppearanceForRender } from '../config/sceneAppearance'
import { AdminLoginModal } from './admin/AdminLoginModal'
import { AdminPanel } from './admin/AdminPanel'
import { CustomTerrain } from './CustomTerrain'
import { SurroundTerrain } from './SurroundTerrain'
import { AnimatedWater } from './AnimatedWater'
import { OsmFeatureLayer } from './OsmFeatureLayer'
import { SceneFog } from './SceneFog'
import { PlacedPropsLayer } from './PlacedPropsLayer'
import { PropPreviewOutline } from './PropPreviewOutline'
import { SculptBrushPreview } from './SculptBrushPreview'
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
import { RateLimitOverlay, SculptRateLimitOverlay } from './PlacedPropsLayer'
import { TerrainHeightmapProvider, useTerrainHeightmap } from '../context/TerrainHeightmapProvider'
import { TerrainSculptProvider } from '../context/TerrainSculptProvider'
import { waterSurfaceWorldY } from '../utils/terrainLayerNudge'
import { SandboxOrbitControls } from './SceneCamera'
import { useAdminShortcut } from '../hooks/useAdminShortcut'
import { useSandboxShortcuts } from '../hooks/useSandboxShortcuts'
import { isEditMode, isPlacementMode, isSculptMode, sculptToolFromMode, type InteractionMode } from '../types/interaction'
import { useTerrainSculpt } from '../context/TerrainSculptProvider'

type SandboxCanvasProps = {
  mode: InteractionMode
  previewRadius: number
  orbitEnabled: boolean
  onPreviewChange: (position: [number, number, number] | null) => void
  onPreviewValidChange: (valid: boolean) => void
  onPlaceConfirm: (point?: THREE.Vector3) => void
  onTouchPlacementStart: () => void
  onTouchPlacementEnd: () => void
  sculptEnabled: boolean
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
  sculptEnabled,
}: SandboxCanvasProps) {
  const { selectedPropId, selectProp, settings } = useSandbox()
  const { zoneDrawingMode, addDraftZonePoint } = useAdmin()
  const { setPreview, getPreview } = usePlacementPreview()
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const { getHeightAt } = useTerrainHeight()
  const { osmFeatures, seaLevelWorldY } = useTerrainHeightmap()

  const sceneAppearance = sceneAppearanceForRender(settings.sceneAppearance)
  const { backgroundColor, hdriPreset, camera, terrain } = sceneAppearance
  const waterClipLevel = waterSurfaceWorldY(seaLevelWorldY, terrain.layerNudges.water, sceneAppearance.water.level)

  const placementMode = isPlacementMode(mode)
  const editMode = isEditMode(mode)
  const sculptMode = isSculptMode(mode) && settings.userVisibility.showSculptTools
  const sculptActive = sculptMode && sculptEnabled
  const activeSculptTool = sculptActive ? sculptToolFromMode(mode) : null
  const reservePrimaryPointer = (placementMode || sculptMode || editMode) && !zoneDrawingMode
  const { setBrushPreview } = useTerrainSculpt()

  useEffect(() => {
    if (!sculptActive) setBrushPreview(null)
  }, [sculptActive, setBrushPreview])

  const handlePreviewMove = useCallback(
    (point: THREE.Vector3, valid: boolean) => {
      if (!isPlacementMode(mode)) return
      const raw = propPositionFromPoint(point)
      if (!valid) {
        setPreview([raw[0], waterClipLevel, raw[2]], false)
        return
      }

      const snapped = previewPlacementPosition(raw, settingsRef.current, getHeightAt)
      setPreview(snapped, true)
    },
    [getHeightAt, mode, waterClipLevel, setPreview],
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
        <SurroundTerrain />
        <CustomTerrain
          zoneDrawingMode={zoneDrawingMode}
          placementEnabled={placementMode && !zoneDrawingMode}
          editMode={editMode && !zoneDrawingMode}
          mode={mode}
        sculptEnabled={sculptActive}
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

      {sculptActive && activeSculptTool && <SculptBrushPreview tool={activeSculptTool} />}

      <PlacedPropsLayer
        selectedPropId={selectedPropId}
        onSelect={selectProp}
        selectionEnabled={editMode}
      />

      <OsmFeatureLayer
        data={osmFeatures}
        enabled={terrain.osmFeaturesEnabled}
        nudge={terrain.layerNudges.osm}
      />

      <SandboxOrbitControls
        camera={camera}
        enabled={orbitEnabled}
        reservePrimaryPointer={reservePrimaryPointer}
      />
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
  const { settings, placeProp, getPropDefinition, selectProp, clearPlacementError, isMultiplayerLoading, isLayoutLocked } =
    useSandbox()
  const { isAdmin } = useAdmin()
  const { setPreview } = usePlacementPreview()
  const sceneAppearance = sceneAppearanceForRender(settings.sceneAppearance)
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

  const sculptBlocked = isLayoutLocked && !isAdmin
  const sculptEnabled = !sculptBlocked

  const handleModeChange = useCallback(
    (nextMode: InteractionMode) => {
      setMode(nextMode)
      setHasPreview(false)
      clearPlacementError()
      selectProp(null)
    },
    [clearPlacementError, selectProp],
  )

  useEffect(() => {
    if (!settings.userVisibility.showSculptTools && isSculptMode(mode)) {
      setMode('placement')
    }
  }, [mode, settings.userVisibility.showSculptTools])

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
          near: sceneAppearance.camera.near,
          far: sceneAppearance.camera.far,
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
          sculptEnabled={sculptEnabled}
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
      <SculptRateLimitOverlay />
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
      <TerrainSculptProvider>
        <PlacementPreviewProvider>
          <SandboxExperience />
        </PlacementPreviewProvider>
      </TerrainSculptProvider>
    </TerrainHeightmapProvider>
  )
}
