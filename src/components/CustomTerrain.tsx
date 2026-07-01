import { useMemo, useRef, useEffect } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { TERRAIN_SEGMENTS, TERRAIN_SIZE } from '../constants/terrain'
import { useSandbox } from '../context/SandboxProvider'
import { useTerrainHeightmap } from '../context/TerrainHeightmapProvider'
import { normalizeSceneAppearance } from '../config/sceneAppearance'
import { createGridTexture } from '../utils/gridTexture'
import { createTextureFromCanvas } from '../utils/terrainSurface'
import { TerrainMaterial } from './TerrainMaterial'
import {
  CLICK_DRAG_THRESHOLD_PX,
  isClickGesture,
  isTouchPointer,
} from '../utils/pointer'

export { TERRAIN_SIZE, TERRAIN_SEGMENTS }
export { TERRAIN_MAX_HEIGHT } from '../constants/terrain'

import { sampleHeightmapPixel } from '../utils/terrainHeight'
import { worldUvFromWorld } from '../utils/geoReference'
import type { TerrainGeoReference } from '../types/sandbox'

function displaceGeometry(
  geometry: THREE.PlaneGeometry,
  imageData: ImageData,
  maxHeight: number,
  geo: TerrainGeoReference,
): void {
  const positions = geometry.attributes.position

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = -y
    const { u, v } = worldUvFromWorld(x, z, geo)
    const height = sampleHeightmapPixel(imageData, u, v) * maxHeight
    positions.setZ(i, height)
  }

  positions.needsUpdate = true
  geometry.computeVertexNormals()
}

type PointerSession = {
  x: number
  y: number
  pointerType: string
  dragged: boolean
}

type CustomTerrainProps = {
  zoneDrawingMode?: boolean
  placementEnabled?: boolean
  editMode?: boolean
  onPreviewMove?: (point: THREE.Vector3, valid: boolean) => void
  onPreviewLeave?: () => void
  onPlaceConfirm?: (point?: THREE.Vector3) => void
  onEditModeTerrainClick?: () => void
  onZonePoint?: (x: number, z: number) => void
  onTouchPlacementStart?: () => void
  onTouchPlacementEnd?: () => void
}

export function CustomTerrain({
  zoneDrawingMode = false,
  placementEnabled = true,
  editMode = false,
  onPreviewMove,
  onPreviewLeave,
  onPlaceConfirm,
  onEditModeTerrainClick,
  onZonePoint,
  onTouchPlacementStart,
  onTouchPlacementEnd,
}: CustomTerrainProps) {
  const { settings } = useSandbox()
  const { imageData, maxHeight, surfaceCanvas } = useTerrainHeightmap()
  const sceneAppearance = normalizeSceneAppearance(settings.sceneAppearance)
  const { terrainFillColor, terrainFillOpacity, terrainGridColor, water, terrain } = sceneAppearance

  const mapTexture = useMemo(() => {
    if (terrain.surfaceStyle !== 'grid' && surfaceCanvas) {
      return createTextureFromCanvas(surfaceCanvas)
    }
    return createGridTexture(terrainFillColor, terrainGridColor, terrainFillOpacity)
  }, [
    terrain.surfaceStyle,
    surfaceCanvas,
    terrainFillColor,
    terrainFillOpacity,
    terrainGridColor,
  ])

  useEffect(() => () => mapTexture.dispose(), [mapTexture])

  const terrainFillTransparent = terrainFillOpacity < 1
  const clipUnderwater = water.enabled
  const pointerSessionRef = useRef<PointerSession | null>(null)
  const previewFrameRef = useRef<number | null>(null)
  const pendingPreviewRef = useRef<THREE.Vector3 | null>(null)
  const pendingPreviewValidRef = useRef(true)

  const isUnderwater = (point: THREE.Vector3) => water.enabled && point.y < water.level

  const updatePreview = (point: THREE.Vector3, valid: boolean) => {
    pendingPreviewRef.current = point
    pendingPreviewValidRef.current = valid
    if (previewFrameRef.current !== null) return

    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = null
      const pending = pendingPreviewRef.current
      if (pending) onPreviewMove?.(pending, pendingPreviewValidRef.current)
    })
  }

  useEffect(
    () => () => {
      if (previewFrameRef.current !== null) {
        window.cancelAnimationFrame(previewFrameRef.current)
      }
    },
    [],
  )

  const markDragIfNeeded = (clientX: number, clientY: number) => {
    const session = pointerSessionRef.current
    if (!session || session.dragged) return

    if (
      Math.hypot(clientX - session.x, clientY - session.y) >
      CLICK_DRAG_THRESHOLD_PX
    ) {
      session.dragged = true
    }
  }

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (isUnderwater(event.point)) return

    pointerSessionRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
      dragged: false,
    }

    if (zoneDrawingMode || editMode) return

    if (!placementEnabled) return

    event.stopPropagation()

    if (isTouchPointer(event.pointerType)) {
      onTouchPlacementStart?.()
      updatePreview(event.point, !isUnderwater(event.point))
    }
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (zoneDrawingMode || !placementEnabled) return

    const session = pointerSessionRef.current
    const touch = isTouchPointer(event.pointerType)
    const underwater = isUnderwater(event.point)

    if (!session) {
      if (!touch && event.buttons === 0) {
        updatePreview(event.point, !underwater)
      }
      return
    }

    markDragIfNeeded(event.clientX, event.clientY)

    if (touch && event.buttons > 0) {
      updatePreview(event.point, !underwater)
    }
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const session = pointerSessionRef.current
    pointerSessionRef.current = null
    if (!session) return
    if (isUnderwater(event.point)) return

    if (isTouchPointer(session.pointerType)) {
      onTouchPlacementEnd?.()
    }

    markDragIfNeeded(event.clientX, event.clientY)

    if (session.dragged) return

    if (!isClickGesture(session.x, session.y, event.clientX, event.clientY)) return

    event.stopPropagation()

    if (zoneDrawingMode) {
      onZonePoint?.(event.point.x, event.point.z)
      return
    }

    if (editMode) {
      onEditModeTerrainClick?.()
      return
    }

    if (!placementEnabled) return

    if (isTouchPointer(session.pointerType)) {
      onPlaceConfirm?.()
      return
    }

    updatePreview(event.point, !isUnderwater(event.point))
    onPlaceConfirm?.(event.point)
  }

  const clearPointerSession = () => {
    const session = pointerSessionRef.current
    pointerSessionRef.current = null

    if (session && isTouchPointer(session.pointerType)) {
      onTouchPlacementEnd?.()
    }
  }

  const handlePointerLeave = (event: ThreeEvent<PointerEvent>) => {
    if (!isTouchPointer(event.pointerType) && event.buttons === 0) {
      onPreviewLeave?.()
    }

    clearPointerSession()
  }

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS),
    [],
  )

  const terrainGeoKey = `${terrain.originLat},${terrain.originLng},${terrain.spanLat},${terrain.spanLng}`

  const displacedGeometry = useMemo(() => {
    if (!imageData) return null

    const geo = geometry.clone()
    displaceGeometry(geo, imageData, maxHeight, terrain)
    return geo
  }, [geometry, imageData, maxHeight, terrainGeoKey])

  if (!displacedGeometry) return null

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      geometry={displacedGeometry}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={clearPointerSession}
    >
      <TerrainMaterial
        map={mapTexture}
        seaLevel={water.level}
        clipUnderwater={clipUnderwater}
        terrainFillTransparent={terrainFillTransparent}
      />
    </mesh>
  )
}
