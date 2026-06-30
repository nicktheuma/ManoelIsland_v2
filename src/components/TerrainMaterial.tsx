import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type TerrainMaterialProps = {
  map: THREE.Texture
  seaLevel: number
  clipUnderwater: boolean
  terrainFillTransparent: boolean
}

export function TerrainMaterial({
  map,
  seaLevel,
  clipUnderwater,
  terrainFillTransparent,
}: TerrainMaterialProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const uniformsRef = useRef<{
    uSeaLevel: { value: number }
    uClipEnabled: { value: number }
  } | null>(null)

  useEffect(() => {
    const material = materialRef.current
    if (!material) return

    material.onBeforeCompile = (shader) => {
      uniformsRef.current = {
        uSeaLevel: { value: seaLevel },
        uClipEnabled: { value: clipUnderwater ? 1 : 0 },
      }

      shader.uniforms.uSeaLevel = uniformsRef.current.uSeaLevel
      shader.uniforms.uClipEnabled = uniformsRef.current.uClipEnabled

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
varying float vTerrainWorldY;`,
      )

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vTerrainWorldY = worldPosition.y;`,
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
varying float vTerrainWorldY;
uniform float uSeaLevel;
uniform float uClipEnabled;`,
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `if (uClipEnabled > 0.5 && vTerrainWorldY < uSeaLevel) {
  discard;
}
#include <dithering_fragment>`,
      )
    }

    material.customProgramCacheKey = () => 'terrain-underwater-clip-v1'
    material.needsUpdate = true
  }, [])

  useEffect(() => {
    if (!uniformsRef.current) return
    uniformsRef.current.uSeaLevel.value = seaLevel
    uniformsRef.current.uClipEnabled.value = clipUnderwater ? 1 : 0
  }, [clipUnderwater, seaLevel])

  const transparent = terrainFillTransparent || clipUnderwater

  return (
    <meshStandardMaterial
      ref={materialRef}
      map={map}
      side={THREE.DoubleSide}
      transparent={transparent}
      depthWrite={!transparent}
    />
  )
}
