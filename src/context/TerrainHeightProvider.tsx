import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useSandbox } from './SandboxProvider'
import { useTerrainHeightmap } from './TerrainHeightmapProvider'
import { getTerrainHeightAtAligned } from '../utils/terrainHeight'

type TerrainHeightContextValue = {
  getHeightAt: (x: number, z: number) => number
  projectOntoTerrain: (x: number, z: number, offset?: number) => [number, number, number]
}

const TerrainHeightContext = createContext<TerrainHeightContextValue | null>(null)

export function TerrainHeightProvider({ children }: { children: ReactNode }) {
  const { registerTerrainHeight } = useSandbox()
  const { imageData, elevationContext, terrainAlignment } = useTerrainHeightmap()

  const value = useMemo<TerrainHeightContextValue>(() => {
    if (!imageData) {
      return {
        getHeightAt: () => 0,
        projectOntoTerrain: (x, z, offset = 0.15) => [x, offset, z],
      }
    }

    return {
      getHeightAt: (x, z) =>
        getTerrainHeightAtAligned(x, z, imageData, terrainAlignment, elevationContext),
      projectOntoTerrain: (x, z, offset = 0.15) => {
        const y =
          getTerrainHeightAtAligned(x, z, imageData, terrainAlignment, elevationContext) + offset
        return [x, y, z]
      },
    }
  }, [imageData, elevationContext, terrainAlignment])

  useEffect(() => {
    if (!imageData) {
      registerTerrainHeight(null)
      return () => registerTerrainHeight(null)
    }

    registerTerrainHeight(value.getHeightAt)
    return () => registerTerrainHeight(null)
  }, [imageData, registerTerrainHeight, value])

  return (
    <TerrainHeightContext.Provider value={value}>{children}</TerrainHeightContext.Provider>
  )
}

export function useTerrainHeight(): TerrainHeightContextValue {
  const context = useContext(TerrainHeightContext)
  if (!context) {
    throw new Error('useTerrainHeight must be used within TerrainHeightProvider')
  }
  return context
}
