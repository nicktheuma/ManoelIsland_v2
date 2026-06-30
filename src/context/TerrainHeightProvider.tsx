import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { HEIGHTMAP_URL } from '../constants/terrain'
import { useSandbox } from './SandboxProvider'
import { getTerrainHeightAt, heightmapToImageData } from '../utils/terrainHeight'

type TerrainHeightContextValue = {
  getHeightAt: (x: number, z: number) => number
  projectOntoTerrain: (x: number, z: number, offset?: number) => [number, number, number]
}

const TerrainHeightContext = createContext<TerrainHeightContextValue | null>(null)

export function TerrainHeightProvider({ children }: { children: ReactNode }) {
  const { registerTerrainHeight } = useSandbox()
  const heightmap = useLoader(THREE.TextureLoader, HEIGHTMAP_URL)

  const value = useMemo<TerrainHeightContextValue>(() => {
    const image = heightmap.image as HTMLImageElement
    const imageData = heightmapToImageData(image)

    return {
      getHeightAt: (x, z) => getTerrainHeightAt(x, z, imageData),
      projectOntoTerrain: (x, z, offset = 0.15) => {
        const y = getTerrainHeightAt(x, z, imageData) + offset
        return [x, y, z]
      },
    }
  }, [heightmap])

  useEffect(() => {
    registerTerrainHeight(value.getHeightAt)
    return () => registerTerrainHeight(null)
  }, [registerTerrainHeight, value])

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
