import { useMemo, useRef, useEffect } from 'react'

import { type ThreeEvent } from '@react-three/fiber'

import * as THREE from 'three'

import { terrainMeshSegments } from '../utils/terrainMeshQuality'

import { useSandbox } from '../context/SandboxProvider'

import { useTerrainHeightmap } from '../context/TerrainHeightmapProvider'

import { useSculptPointerHandlers } from '../hooks/useSculptPointerHandlers'

import { sculptToolFromMode, type InteractionMode } from '../types/interaction'

import { normalizeSceneAppearance } from '../config/sceneAppearance'

import { createGridTexture } from '../utils/gridTexture'

import { createTextureFromCanvas } from '../utils/terrainSurface'

import { TerrainMaterial } from './TerrainMaterial'

import {

  CLICK_DRAG_THRESHOLD_PX,

  isClickGesture,

  isTouchPointer,

} from '../utils/pointer'



export { TERRAIN_SIZE, TERRAIN_SEGMENTS } from '../constants/terrain'

export { TERRAIN_MAX_HEIGHT } from '../constants/terrain'



import {

  sampleHeightmapBilinear,

} from '../utils/terrainHeight'

import { latLngFromWorldAligned, rasterUvFromWorld, type TerrainAlignment } from '../utils/terrainAlignment'

import { pointInPolygon } from '../utils/geo'

import { normalizedHeightToWorldY } from '../utils/terrainElevation'

import { applyMapTextureLayerNudge, layerNudgeToMeshScale, waterSurfaceWorldY } from '../utils/terrainLayerNudge'

import type { LatLng } from '../types/sandbox'

import type { TerrainElevationContext } from '../utils/terrainElevation'



function displaceGeometry(

  geometry: THREE.PlaneGeometry,

  imageData: ImageData,

  alignment: TerrainAlignment,

  elevationCtx: TerrainElevationContext,

  polygon: LatLng[],

): void {

  const positions = geometry.attributes.position

  const uvAttr = geometry.attributes.uv

  const insideAttr = new Float32Array(positions.count)



  for (let i = 0; i < positions.count; i++) {

    const x = positions.getX(i)

    const localY = positions.getY(i)

    const z = -localY



    const { u, v } = rasterUvFromWorld(x, z, alignment)

    uvAttr.setXY(i, u, v)



    const [lat, lng] = latLngFromWorldAligned(x, z, alignment)

    const insidePolygon =

      polygon.length >= 3 && pointInPolygon(lat, lng, polygon)

    const sample = sampleHeightmapBilinear(imageData, u, v)

    const inside = insidePolygon && sample.alpha > 0.08



    insideAttr[i] = inside ? 1 : 0



    const height = inside

      ? normalizedHeightToWorldY(sample.height, alignment.geo, elevationCtx)

      : 0



    positions.setZ(i, height)

  }



  geometry.setAttribute('aInside', new THREE.BufferAttribute(insideAttr, 1))

  positions.needsUpdate = true

  uvAttr.needsUpdate = true

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

  mode?: InteractionMode

  sculptEnabled?: boolean

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

  mode = 'placement',

  sculptEnabled = false,

}: CustomTerrainProps) {

  const { settings } = useSandbox()

  const sculptTool = sculptEnabled ? sculptToolFromMode(mode) : null

  const { imageData, surfaceCanvas, elevationContext, terrainAlignment, seaLevelWorldY } =
    useTerrainHeightmap()

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
  const clipOutsidePolygon = terrain.source === 'dem' && terrain.polygon.length >= 3

  const waterClipLevel = useMemo(
    () => waterSurfaceWorldY(seaLevelWorldY, terrain.layerNudges.water, water.level),
    [seaLevelWorldY, terrain.layerNudges.water.height, water.level],
  )

  const pointerSessionRef = useRef<PointerSession | null>(null)

  const previewFrameRef = useRef<number | null>(null)

  const pendingPreviewRef = useRef<THREE.Vector3 | null>(null)

  const pendingPreviewValidRef = useRef(true)



  const isUnderwater = (point: THREE.Vector3) => water.enabled && point.y < waterClipLevel

  const sculptPointer = useSculptPointerHandlers({
    sculptTool,
    sculptEnabled: Boolean(sculptTool),
    waterClipLevel,
    waterEnabled: water.enabled,
  })

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

    if (sculptTool) {

      sculptPointer.handlePointerDown(event)

      return

    }

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

    if (sculptTool) {

      sculptPointer.handlePointerMove(event)

      return

    }

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

    if (sculptTool) {

      sculptPointer.handlePointerUp(event)

      return

    }

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

    if (sculptTool) {

      sculptPointer.handlePointerLeave()

      return

    }

    if (!isTouchPointer(event.pointerType) && event.buttons === 0) {

      onPreviewLeave?.()

    }



    clearPointerSession()

  }



  const terrainGeoKey = `${terrain.originLat},${terrain.originLng},${terrain.spanLat},${terrain.spanLng}`

  const meshExtents = terrainAlignment.meshExtents

  const heightmapNudge = terrain.layerNudges.heightmap
  const meshScale = useMemo(
    () => layerNudgeToMeshScale(heightmapNudge),
    [heightmapNudge.scaleX, heightmapNudge.scaleY],
  )
  const meshPosition = useMemo(
    (): [number, number, number] => [heightmapNudge.x, 0, heightmapNudge.y],
    [heightmapNudge.x, heightmapNudge.y],
  )

  useEffect(() => {
    applyMapTextureLayerNudge(mapTexture, terrain.layerNudges.surface, meshExtents)
  }, [
    mapTexture,
    meshExtents.depth,
    meshExtents.width,
    terrain.layerNudges.surface.x,
    terrain.layerNudges.surface.y,
    terrain.layerNudges.surface.scaleX,
    terrain.layerNudges.surface.scaleY,
  ])

  const geometry = useMemo(() => {

    const baseSeg = terrainMeshSegments(terrain.meshQuality)

    const maxDim = Math.max(meshExtents.width, meshExtents.depth)

    const segW = Math.max(16, Math.round(baseSeg * (meshExtents.width / maxDim)))

    const segD = Math.max(16, Math.round(baseSeg * (meshExtents.depth / maxDim)))

    return new THREE.PlaneGeometry(meshExtents.width, meshExtents.depth, segW, segD)

  }, [terrain.meshQuality, meshExtents.width, meshExtents.depth])



  const polygonKey = terrain.polygon.map(([lat, lng]) => `${lat},${lng}`).join('|')



  const displacedGeometry = useMemo(() => {

    if (!imageData) return null



    const geo = geometry.clone()

    displaceGeometry(geo, imageData, terrainAlignment, elevationContext, terrain.polygon)

    return geo

  }, [geometry, imageData, elevationContext, terrainAlignment, terrainGeoKey, terrain.meshQuality, polygonKey, terrain.polygon, heightmapNudge.x, heightmapNudge.y, heightmapNudge.scaleX, heightmapNudge.scaleY])



  if (!displacedGeometry) return null



  return (

    <mesh

      rotation={[-Math.PI / 2, 0, 0]}

      position={meshPosition}

      scale={meshScale}

      geometry={displacedGeometry}

      onPointerDown={handlePointerDown}

      onPointerMove={handlePointerMove}

      onPointerUp={handlePointerUp}

      onPointerLeave={handlePointerLeave}

      onPointerCancel={clearPointerSession}

    >

      <TerrainMaterial

        map={mapTexture}

        seaLevel={waterClipLevel}

        clipUnderwater={clipUnderwater}

        terrainFillTransparent={terrainFillTransparent}

        clipOutsidePolygon={clipOutsidePolygon}
        mapWorldExtents={meshExtents}
      />

    </mesh>

  )

}


