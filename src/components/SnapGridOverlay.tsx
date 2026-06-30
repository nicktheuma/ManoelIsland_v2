import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { TERRAIN_SIZE } from '../constants/terrain'
import { useSandbox } from '../context/SandboxProvider'

export function SnapGridOverlay() {
  const { settings } = useSandbox()
  const { placementRules, userVisibility } = settings

  const showGrid =
    placementRules.snapGridEnabled && userVisibility.showSnapGrid

  const lines = useMemo(() => {
    if (!showGrid) return []
    const size = placementRules.snapGridSize
    const half = TERRAIN_SIZE / 2
    const segments: [number, number, number][][] = []

    for (let x = -half; x <= half; x += size) {
      segments.push([
        [x, 0.05, -half],
        [x, 0.05, half],
      ])
    }
    for (let z = -half; z <= half; z += size) {
      segments.push([
        [-half, 0.05, z],
        [half, 0.05, z],
      ])
    }
    return segments
  }, [placementRules.snapGridSize, showGrid])

  if (!showGrid) return null

  return (
    <>
      {lines.map((points, index) => (
        <Line key={index} points={points} color="#64748b" transparent opacity={0.35} />
      ))}
    </>
  )
}
