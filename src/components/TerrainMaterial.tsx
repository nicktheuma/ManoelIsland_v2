import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { TERRAIN_SIZE } from '../constants/terrain'
import type { TerrainMeshExtentSlice } from '../utils/terrainElevation'

type TerrainMaterialProps = {
  map: THREE.Texture
  seaLevel: number
  clipUnderwater: boolean
  terrainFillTransparent: boolean
  clipOutsidePolygon: boolean
  mapWorldExtents?: TerrainMeshExtentSlice
}

const DEFAULT_EXTENTS: TerrainMeshExtentSlice = { width: TERRAIN_SIZE, depth: TERRAIN_SIZE }

export function TerrainMaterial({
  map,
  seaLevel,
  clipUnderwater,
  terrainFillTransparent,
  clipOutsidePolygon,
  mapWorldExtents = DEFAULT_EXTENTS,
}: TerrainMaterialProps) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const uniformsRef = useRef<{
    uSeaLevel: { value: number }
    uClipEnabled: { value: number }
    uClipPolygon: { value: number }
  } | null>(null)

  useEffect(() => {
    const material = materialRef.current
    if (!material) return

    material.onBeforeCompile = (shader) => {
      uniformsRef.current = {
        uSeaLevel: { value: seaLevel },
        uClipEnabled: { value: clipUnderwater ? 1 : 0 },
        uClipPolygon: { value: clipOutsidePolygon ? 1 : 0 },
      }

      shader.uniforms.uSeaLevel = uniformsRef.current.uSeaLevel
      shader.uniforms.uClipEnabled = uniformsRef.current.uClipEnabled
      shader.uniforms.uClipPolygon = uniformsRef.current.uClipPolygon

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
attribute float aInside;
varying float vTerrainWorldY;
varying float vInside;`,
      )

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vInside = aInside;
vec4 terrainWorldPos = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  terrainWorldPos = instanceMatrix * terrainWorldPos;
#endif
vTerrainWorldY = ( modelMatrix * terrainWorldPos ).y;`,
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
varying float vTerrainWorldY;
varying float vInside;
uniform float uSeaLevel;
uniform float uClipEnabled;
uniform float uClipPolygon;`,
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `if (uClipPolygon > 0.5 && vInside < 0.5) {
  discard;
}
if (uClipEnabled > 0.5 && vTerrainWorldY < uSeaLevel) {
  discard;
}
#include <dithering_fragment>`,
      )
    }

    material.customProgramCacheKey = () =>
      `terrain-geo-map-v6-${mapWorldExtents.width.toFixed(2)}-${mapWorldExtents.depth.toFixed(2)}-${clipOutsidePolygon ? 'poly' : 'full'}-${clipUnderwater ? 'water' : 'dry'}`
    material.needsUpdate = true
  }, [clipOutsidePolygon, clipUnderwater, mapWorldExtents.depth, mapWorldExtents.width])

  useEffect(() => {
    if (!uniformsRef.current) return
    uniformsRef.current.uSeaLevel.value = seaLevel
    uniformsRef.current.uClipEnabled.value = clipUnderwater ? 1 : 0
    uniformsRef.current.uClipPolygon.value = clipOutsidePolygon ? 1 : 0
  }, [clipUnderwater, clipOutsidePolygon, seaLevel])

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
