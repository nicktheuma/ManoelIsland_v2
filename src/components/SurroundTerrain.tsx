import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useSandbox } from '../context/SandboxProvider'
import { useTerrainHeightmap } from '../context/TerrainHeightmapProvider'
import { normalizeSceneAppearance } from '../config/sceneAppearance'
import {
  extendedGeoReference,
  latLngFromWorld,
  worldUvFromWorld,
} from '../utils/geoReference'
import { pointInPolygon } from '../utils/geo'
import { sampleHeightmapBilinear } from '../utils/terrainHeight'
import {
  normalizedHeightToWorldY,
  terrainMeshExtents,
  worldUnitsPerMeter,
} from '../utils/terrainElevation'
import { layerNudgeToPosition } from '../utils/terrainLayerNudge'
import type { LatLng, TerrainGeoReference } from '../types/sandbox'
import type { TerrainElevationContext, TerrainMeshExtents } from '../utils/terrainElevation'

const SURROUND_SEGMENTS = { low: 48, medium: 72 } as const

function displaceSurroundGeometry(
  geometry: THREE.PlaneGeometry,
  imageData: ImageData,
  innerGeo: TerrainGeoReference,
  surroundGeo: TerrainGeoReference,
  innerPolygon: LatLng[],
  innerExtents: TerrainMeshExtents,
  surroundExtents: TerrainMeshExtents,
  elevationCtx: TerrainElevationContext,
): void {
  const positions = geometry.attributes.position

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const localY = positions.getY(i)
    const z = -localY

    const { u, v } = worldUvFromWorld(x, z, surroundExtents)
    const [lat, lng] = latLngFromWorld(x, z, innerGeo, innerExtents)

    const insideInnerSquare =
      Math.abs(x) <= innerExtents.width / 2 && Math.abs(z) <= innerExtents.depth / 2
    const insidePolygon =
      innerPolygon.length >= 3 && pointInPolygon(lat, lng, innerPolygon)
    const deferToMainTerrain = insideInnerSquare && insidePolygon

    let height = 0
    if (!deferToMainTerrain) {
      const sample = sampleHeightmapBilinear(imageData, u, v)
      if (sample.alpha > 0.02) {
        height = normalizedHeightToWorldY(sample.height, surroundGeo, elevationCtx) * 0.7
      }
    }

    positions.setZ(i, height)
  }

  positions.needsUpdate = true
  geometry.computeVertexNormals()
}

export function SurroundTerrain() {
  const { settings } = useSandbox()
  const { surroundImageData, surroundElevationContext, isSurroundLoading } = useTerrainHeightmap()
  const sceneAppearance = normalizeSceneAppearance(settings.sceneAppearance)
  const { terrain, terrainFillColor } = sceneAppearance

  const terrainGeoKey = `${terrain.originLat},${terrain.originLng},${terrain.spanLat},${terrain.spanLng},${terrain.surroundScale}`

  const uniformWupm = useMemo(() => worldUnitsPerMeter(terrain), [terrainGeoKey])

  const innerExtents = useMemo(
    () => terrainMeshExtents(terrain, uniformWupm),
    [terrain, uniformWupm],
  )

  const surroundGeo = useMemo(
    () => extendedGeoReference(terrain, terrain.surroundScale),
    [terrain, terrain.surroundScale],
  )

  const surroundExtents = useMemo(
    () => terrainMeshExtents(surroundGeo, uniformWupm),
    [surroundGeo, uniformWupm],
  )

  const segments = SURROUND_SEGMENTS[terrain.surroundDetail]

  const geometry = useMemo(() => {
    if (
      !terrain.surroundEnabled ||
      !surroundImageData ||
      !surroundElevationContext ||
      terrain.source !== 'dem'
    ) {
      return null
    }

    const maxDim = Math.max(surroundExtents.width, surroundExtents.depth)
    const segW = Math.max(12, Math.round(segments * (surroundExtents.width / maxDim)))
    const segD = Math.max(12, Math.round(segments * (surroundExtents.depth / maxDim)))

    const geo = new THREE.PlaneGeometry(
      surroundExtents.width,
      surroundExtents.depth,
      segW,
      segD,
    )
    displaceSurroundGeometry(
      geo,
      surroundImageData,
      terrain,
      surroundGeo,
      terrain.polygon,
      innerExtents,
      surroundExtents,
      surroundElevationContext,
    )
    return geo
  }, [
    surroundImageData,
    surroundElevationContext,
    terrain.source,
    terrain.surroundEnabled,
    terrain.polygon,
    surroundGeo,
    innerExtents,
    surroundExtents,
    segments,
  ])

  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry || isSurroundLoading) return null

  const [offsetX, , offsetZ] = layerNudgeToPosition(terrain.layerNudges.surround)

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[offsetX, -0.05, offsetZ]}
      geometry={geometry}
      receiveShadow
    >
      <meshStandardMaterial
        color={terrainFillColor}
        roughness={0.92}
        metalness={0}
        transparent={terrain.surroundOpacity < 1}
        opacity={terrain.surroundOpacity}
      />
    </mesh>
  )
}
