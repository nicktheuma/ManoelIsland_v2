import { useMemo } from 'react'
import * as THREE from 'three'

const PLANE_SIZE = 200
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

export function GroundPlane() {
  const gridTexture = useMemo(() => createGridTexture(), [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
      <meshStandardMaterial map={gridTexture} side={THREE.DoubleSide} />
    </mesh>
  )
}
