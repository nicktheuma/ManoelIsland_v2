import { useCallback, useEffect, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useTerrainSculpt } from '../context/TerrainSculptProvider'
import { useTerrainHeight } from '../context/TerrainHeightProvider'
import { sculptBrushPreviewPosition, type SculptTool } from '../utils/terrainSculpt'

type UseSculptPointerOptions = {
  sculptTool: SculptTool | null
  sculptEnabled: boolean
  waterClipLevel: number
  waterEnabled: boolean
}

export function useSculptPointerHandlers({
  sculptTool,
  sculptEnabled,
  waterClipLevel,
  waterEnabled,
}: UseSculptPointerOptions) {
  const { applyStroke, setSculptError, setBrushPreview } = useTerrainSculpt()
  const { getHeightAt } = useTerrainHeight()

  const draggingRef = useRef(false)

  useEffect(() => {
    const release = () => {
      draggingRef.current = false
    }
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
    }
  }, [])

  const previewAt = useCallback(
    (x: number, z: number, visible: boolean) => {
      if (!visible || !sculptTool) {
        setBrushPreview(null)
        return
      }
      const terrainY = getHeightAt(x, z)
      setBrushPreview(
        sculptBrushPreviewPosition(x, z, terrainY, waterClipLevel, waterEnabled),
      )
    },
    [getHeightAt, sculptTool, setBrushPreview, waterClipLevel, waterEnabled],
  )

  const runStroke = useCallback(
    (x: number, z: number) => {
      if (!sculptTool) return
      void applyStroke(x, z, sculptTool).then((result) => {
        if (!result.ok) setSculptError(result.message)
      })
    },
    [applyStroke, sculptTool, setSculptError],
  )

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!sculptEnabled || !sculptTool) return
      if (event.button !== 0) return
      event.stopPropagation()
      draggingRef.current = true
      runStroke(event.point.x, event.point.z)
      previewAt(event.point.x, event.point.z, true)
    },
    [previewAt, runStroke, sculptEnabled, sculptTool],
  )

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!sculptEnabled || !sculptTool) return
      if (event.buttons === 0) {
        previewAt(event.point.x, event.point.z, true)
      }
    },
    [previewAt, sculptEnabled, sculptTool],
  )

  const handlePointerUp = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      draggingRef.current = false
      if (!sculptEnabled || !sculptTool) return
      previewAt(event.point.x, event.point.z, true)
    },
    [previewAt, sculptEnabled, sculptTool],
  )

  const handlePointerLeave = useCallback(() => {
    draggingRef.current = false
    setBrushPreview(null)
  }, [setBrushPreview])

  return {
    previewAt,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
  }
}
