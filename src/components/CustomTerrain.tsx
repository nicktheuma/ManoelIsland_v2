import { useMemo, useRef } from 'react'
import { useLoader, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CLICK_DRAG_THRESHOLD_PX,
  isClickGesture,
  isTouchPointer,
} from '../utils/pointer'

export const TERRAIN_SIZE = 200
export const TERRAIN_SEGMENTS = 256
export const TERRAIN_MAX_HEIGHT = 6

const GRID_CELLS = 20

function createGridTexture(size = 512, cells = GRID_CELLS): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, size, size)

  const step = size / cells
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 2

  for (let i = 0; i <= cells; i++) {
    const pos = i * step
    ctx.beginPath()
    ctx.moveTo(pos, 0)
    ctx.lineTo(pos, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, pos)
    ctx.lineTo(size, pos)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function sampleHeightmap(
  imageData: ImageData,
  u: number,
  v: number,
): number {
  const { width, height, data } = imageData
  const x = Math.min(width - 1, Math.max(0, Math.floor(u * (width - 1))))
  const y = Math.min(height - 1, Math.max(0, Math.floor(v * (height - 1))))
  const index = (y * width + x) * 4
  return data[index] / 255
}

function displaceGeometry(
  geometry: THREE.PlaneGeometry,
  imageData: ImageData,
): void {
  const positions = geometry.attributes.position

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const u = x / TERRAIN_SIZE + 0.5
    const v = 1 - (y / TERRAIN_SIZE + 0.5)
    const height = sampleHeightmap(imageData, u, v) * TERRAIN_MAX_HEIGHT
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
  hasPreview?: boolean
  onPreviewMove?: (point: THREE.Vector3) => void
  onPreviewLeave?: () => void
  onPlaceConfirm?: (point?: THREE.Vector3) => void
  onTouchPlacementStart?: () => void
  onTouchPlacementEnd?: () => void
}

export function CustomTerrain({
  hasPreview = false,
  onPreviewMove,
  onPreviewLeave,
  onPlaceConfirm,
  onTouchPlacementStart,
  onTouchPlacementEnd,
}: CustomTerrainProps) {
  const heightmap = useLoader(THREE.TextureLoader, '/assets/manoel_island_heightmap.png')
  const gridTexture = useMemo(() => createGridTexture(), [])
  const pointerSessionRef = useRef<PointerSession | null>(null)

  const updatePreview = (point: THREE.Vector3) => {
    onPreviewMove?.(point)
  }

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
    event.stopPropagation()
    pointerSessionRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
      dragged: false,
    }

    if (isTouchPointer(event.pointerType)) {
      onTouchPlacementStart?.()
      if (!hasPreview) {
        updatePreview(event.point)
      }
    }
  }

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    const session = pointerSessionRef.current
    const touch = isTouchPointer(event.pointerType)

    if (!session) {
      if (!touch && event.buttons === 0) {
        updatePreview(event.point)
      }
      return
    }

    markDragIfNeeded(event.clientX, event.clientY)

    if (touch && event.buttons > 0) {
      updatePreview(event.point)
    }
  }

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const session = pointerSessionRef.current
    pointerSessionRef.current = null
    if (!session) return

    if (isTouchPointer(session.pointerType)) {
      onTouchPlacementEnd?.()
    }

    markDragIfNeeded(event.clientX, event.clientY)

    if (session.dragged) return

    if (!isClickGesture(session.x, session.y, event.clientX, event.clientY)) return

    event.stopPropagation()

    if (isTouchPointer(session.pointerType)) {
      onPlaceConfirm?.()
      return
    }

    updatePreview(event.point)
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

  const displacedGeometry = useMemo(() => {
    const image = heightmap.image as HTMLImageElement | undefined
    if (!image || !image.complete) return null

    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(image, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const geo = geometry.clone()
    displaceGeometry(geo, imageData)
    return geo
  }, [geometry, heightmap])

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
      <meshStandardMaterial map={gridTexture} side={THREE.DoubleSide} />
    </mesh>
  )
}
