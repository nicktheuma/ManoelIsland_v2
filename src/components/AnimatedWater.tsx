import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { sceneAppearanceForRender } from '../config/sceneAppearance'
import { resolveFogColor } from '../config/fogSettings'
import {
  DEFAULT_WATER_SETTINGS,
  hexToVec3,
  packBaseNormalUniforms,
  packEdgeRippleUniforms,
  packNormalLayerUniforms,
  waterMeshSegments,
  waterStyleIndex,
} from '../config/waterSettings'
import { useSandbox } from '../context/SandboxProvider'
import { useTerrainHeightmap } from '../context/TerrainHeightmapProvider'
import { waterSurfaceWorldY } from '../utils/terrainLayerNudge'
import { computeWaterShorelineContour } from '../utils/waterShorelineContour'
import { packShorelineEdgeVertices, WATER_EDGE_MAX_VERTICES, type PackedTerrainEdge } from '../utils/waterTerrainEdge'
import type { WaterSettings } from '../types/sandbox'
import { waterFragmentShader, waterVertexShader } from '../shaders/waterShader'

type AnimatedWaterProps = {
  placementPreviewEnabled?: boolean
  onPreviewMove?: (point: THREE.Vector3, valid: boolean) => void
}

function applyTerrainEdgeVertices(uniform: THREE.IUniform, packed: PackedTerrainEdge) {
  const coords = uniform.value as Float32Array
  coords.fill(0)
  for (let i = 0; i < packed.count; i += 1) {
    coords[i * 2] = packed.vertices[i * 2]
    coords[i * 2 + 1] = packed.vertices[i * 2 + 1]
  }
}

function createWaterUniforms(planeHalfSize: number): Record<string, THREE.IUniform> {
  const water = DEFAULT_WATER_SETTINGS
  const baseNormal = packBaseNormalUniforms(water)
  const normalLayers = packNormalLayerUniforms(water)
  const edgeRipples = packEdgeRippleUniforms(water)

  return {
    uTime: { value: 0 },
    uWaveHeight: { value: water.waveHeight },
    uWaveIntensity: { value: water.waveIntensity },
    uWaveRandomness: { value: water.waveRandomness },
    uWaveSeed: { value: water.waveSeed },
    uWaveScale: { value: water.waveScale },
    uDisplacementDistortion: { value: water.displacementDistortion },
    uDisplacementDistortionSpeed: { value: water.displacementDistortionSpeed },
    uDetailDistortion: { value: water.detailDistortion },
    uDetailDistortionSpeed: { value: water.detailDistortionSpeed },
    uDetailLayers: { value: water.detailLayers },
    uDetailScale: { value: water.detailScale },
    uDetailStrength: { value: water.detailStrength },
    uStyle: { value: waterStyleIndex(water.style) },
    uBaseColor: { value: new THREE.Color(water.color) },
    uNormalHighlightColor: { value: new THREE.Color(water.normalHighlightColor) },
    uNormalShadowColor: { value: new THREE.Color(water.normalShadowColor) },
    uNormalColorScale: { value: water.normalColorScale },
    uOpacity: { value: water.opacity },
    uMetalness: { value: water.metalness },
    uRoughness: { value: water.roughness },
    uSunDirection: { value: new THREE.Vector3(0.55, 0.85, 0.35).normalize() },
    uFogEnabled: { value: 0 },
    uFogColor: { value: new THREE.Color('#0c1222') },
    uFogNear: { value: 70 },
    uFogFar: { value: 210 },
    uPlaneHalfSize: { value: planeHalfSize },
    uEdgeFade: { value: water.edgeFade },
    uNormalMapStrength: { value: water.normalMapStrength },
    uNormalMapScale: { value: water.normalMapScale },
    uBaseNormalWaveScale: { value: baseNormal.uBaseNormalWaveScale },
    uBaseNormalStretchX: { value: baseNormal.uBaseNormalStretchX },
    uBaseNormalStretchZ: { value: baseNormal.uBaseNormalStretchZ },
    uBaseNormalRandomness: { value: baseNormal.uBaseNormalRandomness },
    uBaseNormalSpeed: { value: baseNormal.uBaseNormalSpeed },
    uBaseNormalStrength: { value: baseNormal.uBaseNormalStrength },
    uBaseNormalStyle: { value: baseNormal.uBaseNormalStyle },
    uBaseNormalDistortion: { value: baseNormal.uBaseNormalDistortion },
    uBaseNormalDistortionSpeed: { value: baseNormal.uBaseNormalDistortionSpeed },
    uBaseNormalTime: { value: 0 },
    uNormalLayerCount: { value: normalLayers.uNormalLayerCount },
    uNormalLayerWaveScale: { value: [...normalLayers.uNormalLayerWaveScale] },
    uNormalLayerStretchX: { value: [...normalLayers.uNormalLayerStretchX] },
    uNormalLayerStretchZ: { value: [...normalLayers.uNormalLayerStretchZ] },
    uNormalLayerRandomness: { value: [...normalLayers.uNormalLayerRandomness] },
    uNormalLayerSpeed: { value: [...normalLayers.uNormalLayerSpeed] },
    uNormalLayerStrength: { value: [...normalLayers.uNormalLayerStrength] },
    uNormalLayerDistortion: { value: [...normalLayers.uNormalLayerDistortion] },
    uNormalLayerDistortionSpeed: { value: [...normalLayers.uNormalLayerDistortionSpeed] },
    uNormalDetailTime: { value: 0 },
    uTerrainEdgeVertexCount: { value: 0 },
    uTerrainEdgeCoords: { value: new Float32Array(WATER_EDGE_MAX_VERTICES * 2) },
    uEdgeRippleEnabled: { value: edgeRipples.uEdgeRippleEnabled },
    uEdgeRippleStrength: { value: edgeRipples.uEdgeRippleStrength },
    uEdgeRippleSpeed: { value: edgeRipples.uEdgeRippleSpeed },
    uEdgeRippleWaveScale: { value: edgeRipples.uEdgeRippleWaveScale },
    uEdgeRippleFalloff: { value: edgeRipples.uEdgeRippleFalloff },
    uEdgeRippleMaxDist: { value: edgeRipples.uEdgeRippleMaxDist },
    uEdgeRippleDisplacement: { value: edgeRipples.uEdgeRippleDisplacement },
    uEdgeRippleNormal: { value: edgeRipples.uEdgeRippleNormal },
    uEdgeRippleSoftness: { value: edgeRipples.uEdgeRippleSoftness },
    uEdgeRippleTime: { value: 0 },
    uShorelineFadeDistance: { value: water.shorelineFadeDistance },
    uShorelineFadeStrength: { value: water.shorelineFadeStrength },
  }
}

function setUniformArray(uniform: THREE.IUniform<number[]>, values: number[]) {
  if (!Array.isArray(uniform.value) || uniform.value.length !== values.length) {
    uniform.value = values
    return
  }
  for (let i = 0; i < values.length; i += 1) {
    uniform.value[i] = values[i]
  }
}

function applyWaterUniforms(
  uniforms: Record<string, THREE.IUniform>,
  water: WaterSettings,
  planeHalfSize: number,
) {
  uniforms.uWaveHeight.value = water.waveHeight
  uniforms.uWaveIntensity.value = water.waveIntensity
  uniforms.uWaveRandomness.value = water.waveRandomness
  uniforms.uWaveSeed.value = water.waveSeed
  uniforms.uWaveScale.value = water.waveScale
  uniforms.uDisplacementDistortion.value = water.displacementDistortion
  uniforms.uDisplacementDistortionSpeed.value = water.displacementDistortionSpeed
  uniforms.uDetailDistortion.value = water.detailDistortion
  uniforms.uDetailDistortionSpeed.value = water.detailDistortionSpeed
  uniforms.uDetailLayers.value = water.detailLayers
  uniforms.uDetailScale.value = water.detailScale
  uniforms.uDetailStrength.value = water.detailStrength
  uniforms.uStyle.value = waterStyleIndex(water.style)
  uniforms.uBaseColor.value.set(...hexToVec3(water.color))
  uniforms.uNormalHighlightColor.value.set(...hexToVec3(water.normalHighlightColor))
  uniforms.uNormalShadowColor.value.set(...hexToVec3(water.normalShadowColor))
  uniforms.uNormalColorScale.value = water.normalColorScale
  uniforms.uOpacity.value = water.opacity
  uniforms.uMetalness.value = water.metalness
  uniforms.uRoughness.value = water.roughness
  uniforms.uPlaneHalfSize.value = planeHalfSize
  uniforms.uEdgeFade.value = water.edgeFade
  uniforms.uNormalMapStrength.value = water.normalMapStrength
  uniforms.uNormalMapScale.value = water.normalMapScale

  const baseNormal = packBaseNormalUniforms(water)
  uniforms.uBaseNormalWaveScale.value = baseNormal.uBaseNormalWaveScale
  uniforms.uBaseNormalStretchX.value = baseNormal.uBaseNormalStretchX
  uniforms.uBaseNormalStretchZ.value = baseNormal.uBaseNormalStretchZ
  uniforms.uBaseNormalRandomness.value = baseNormal.uBaseNormalRandomness
  uniforms.uBaseNormalSpeed.value = baseNormal.uBaseNormalSpeed
  uniforms.uBaseNormalStrength.value = baseNormal.uBaseNormalStrength
  uniforms.uBaseNormalStyle.value = baseNormal.uBaseNormalStyle
  uniforms.uBaseNormalDistortion.value = baseNormal.uBaseNormalDistortion
  uniforms.uBaseNormalDistortionSpeed.value = baseNormal.uBaseNormalDistortionSpeed

  const normalLayers = packNormalLayerUniforms(water)
  uniforms.uNormalLayerCount.value = normalLayers.uNormalLayerCount
  setUniformArray(uniforms.uNormalLayerWaveScale, normalLayers.uNormalLayerWaveScale)
  setUniformArray(uniforms.uNormalLayerStretchX, normalLayers.uNormalLayerStretchX)
  setUniformArray(uniforms.uNormalLayerStretchZ, normalLayers.uNormalLayerStretchZ)
  setUniformArray(uniforms.uNormalLayerRandomness, normalLayers.uNormalLayerRandomness)
  setUniformArray(uniforms.uNormalLayerSpeed, normalLayers.uNormalLayerSpeed)
  setUniformArray(uniforms.uNormalLayerStrength, normalLayers.uNormalLayerStrength)
  setUniformArray(uniforms.uNormalLayerDistortion, normalLayers.uNormalLayerDistortion)
  setUniformArray(uniforms.uNormalLayerDistortionSpeed, normalLayers.uNormalLayerDistortionSpeed)

  const edgeRipples = packEdgeRippleUniforms(water)
  uniforms.uEdgeRippleEnabled.value = edgeRipples.uEdgeRippleEnabled
  uniforms.uEdgeRippleStrength.value = edgeRipples.uEdgeRippleStrength
  uniforms.uEdgeRippleSpeed.value = edgeRipples.uEdgeRippleSpeed
  uniforms.uEdgeRippleWaveScale.value = edgeRipples.uEdgeRippleWaveScale
  uniforms.uEdgeRippleFalloff.value = edgeRipples.uEdgeRippleFalloff
  uniforms.uEdgeRippleMaxDist.value = edgeRipples.uEdgeRippleMaxDist
  uniforms.uEdgeRippleDisplacement.value = edgeRipples.uEdgeRippleDisplacement
  uniforms.uEdgeRippleNormal.value = edgeRipples.uEdgeRippleNormal
  uniforms.uEdgeRippleSoftness.value = edgeRipples.uEdgeRippleSoftness
  uniforms.uShorelineFadeDistance.value = water.shorelineFadeDistance
  uniforms.uShorelineFadeStrength.value = water.shorelineFadeStrength
}

const EMPTY_PACKED_TERRAIN_EDGE: PackedTerrainEdge = {
  count: 0,
  vertices: new Float32Array(WATER_EDGE_MAX_VERTICES * 2),
}

export function AnimatedWater({
  placementPreviewEnabled = false,
  onPreviewMove,
}: AnimatedWaterProps = {}) {
  const { settings } = useSandbox()
  const { seaLevelWorldY, terrainAlignment, imageData, elevationContext, imageDataGeneration } =
    useTerrainHeightmap()
  const sceneAppearance = useMemo(
    () => sceneAppearanceForRender(settings.sceneAppearance),
    [settings.sceneAppearance],
  )
  const water = sceneAppearance.water
  const waterNudge = sceneAppearance.terrain.layerNudges.water
  const heightmapNudge = sceneAppearance.terrain.layerNudges.heightmap
  const terrainPolygon = settings.sceneAppearance.terrain?.polygon ?? sceneAppearance.terrain.polygon
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const animationSpeedRef = useRef(water.animationSpeed)
  const waterRef = useRef(water)
  waterRef.current = water
  const uniformsRef = useRef<Record<string, THREE.IUniform> | null>(null)

  const segments = waterMeshSegments(water.meshQuality)
  const planeSize = water.planeSize
  const planeHalfSize = planeSize / 2

  const waterClipY = waterSurfaceWorldY(seaLevelWorldY, waterNudge, water.level)
  const waterNudgeX = waterNudge.x
  const waterNudgeY = waterNudge.y

  const polygonKey = useMemo(
    () => terrainPolygon.map(([lat, lng]) => `${lat},${lng}`).join('|'),
    [terrainPolygon],
  )

  const terrainSettings = sceneAppearance.terrain

  const shorelineSettingsKey = useMemo(() => {
    const nudgeKey = `${heightmapNudge.x},${heightmapNudge.y},${heightmapNudge.scaleX},${heightmapNudge.scaleY}`
    return `${terrainSettings.version}-${terrainSettings.sampleSize}-${waterClipY.toFixed(4)}-${water.level}-${waterNudgeY}-${waterNudgeX}-${waterNudge.height}-${nudgeKey}-${polygonKey}`
  }, [
    terrainSettings.version,
    terrainSettings.sampleSize,
    waterClipY,
    water.level,
    waterNudge.height,
    waterNudgeX,
    waterNudgeY,
    heightmapNudge.x,
    heightmapNudge.y,
    heightmapNudge.scaleX,
    heightmapNudge.scaleY,
    polygonKey,
  ])

  const [packedTerrainEdge, setPackedTerrainEdge] = useState<PackedTerrainEdge>(EMPTY_PACKED_TERRAIN_EDGE)
  const lastShorelineSettingsKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!imageData) {
      setPackedTerrainEdge(EMPTY_PACKED_TERRAIN_EDGE)
      lastShorelineSettingsKeyRef.current = null
      return
    }

    let cancelled = false
    const settingsChanged = lastShorelineSettingsKeyRef.current !== shorelineSettingsKey
    lastShorelineSettingsKeyRef.current = shorelineSettingsKey
    const delay = settingsChanged ? 0 : 900

    const timer = window.setTimeout(() => {
      if (cancelled) return
      try {
        const contour = computeWaterShorelineContour(
          imageData,
          terrainAlignment,
          elevationContext,
          terrainPolygon,
          waterClipY,
          heightmapNudge,
        )
        setPackedTerrainEdge(
          packShorelineEdgeVertices(contour, { x: waterNudgeX, y: waterNudgeY }),
        )
      } catch (error) {
        console.warn('Shoreline contour extraction failed:', error)
        setPackedTerrainEdge(EMPTY_PACKED_TERRAIN_EDGE)
      }
    }, delay)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    imageDataGeneration,
    shorelineSettingsKey,
    terrainAlignment,
    elevationContext,
    polygonKey,
    waterClipY,
    waterNudgeX,
    waterNudgeY,
    heightmapNudge.x,
    heightmapNudge.y,
    heightmapNudge.scaleX,
    heightmapNudge.scaleY,
  ])

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(planeSize, planeSize, segments, segments),
    [planeSize, segments],
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  const uniforms = useMemo(() => {
    if (!uniformsRef.current) {
      uniformsRef.current = createWaterUniforms(planeHalfSize)
    }
    uniformsRef.current.uPlaneHalfSize.value = planeHalfSize
    return uniformsRef.current
  }, [planeHalfSize])

  useEffect(() => {
    animationSpeedRef.current = water.animationSpeed
  }, [water.animationSpeed])

  useEffect(() => {
    const material = materialRef.current
    if (!material) return

    const appearance = sceneAppearanceForRender(settings.sceneAppearance)
    const { fog, backgroundColor } = appearance
    const currentWater = appearance.water

    applyWaterUniforms(material.uniforms, currentWater, currentWater.planeSize / 2)

    material.uniforms.uTerrainEdgeVertexCount.value = packedTerrainEdge.count
    applyTerrainEdgeVertices(material.uniforms.uTerrainEdgeCoords, packedTerrainEdge)

    if (fog.enabled) {
      material.uniforms.uFogEnabled.value = 1
      material.uniforms.uFogColor.value.set(resolveFogColor(fog, backgroundColor))
      material.uniforms.uFogNear.value = fog.near
      material.uniforms.uFogFar.value = fog.far
    } else {
      material.uniforms.uFogEnabled.value = 0
    }
  }, [
    settings.sceneAppearance.water,
    settings.sceneAppearance.fog,
    settings.sceneAppearance.backgroundColor,
    settings.sceneAppearance.terrain.layerNudges.water,
    settings.sceneAppearance.terrain.layerNudges.heightmap,
    packedTerrainEdge,
  ])

  useEffect(() => {
    if (uniformsRef.current) {
      uniformsRef.current.uTerrainEdgeVertexCount.value = packedTerrainEdge.count
      applyTerrainEdgeVertices(uniformsRef.current.uTerrainEdgeCoords, packedTerrainEdge)
    }
  }, [packedTerrainEdge])

  useFrame((state) => {
    const material = materialRef.current
    if (!material) return

    const animTime = state.clock.elapsedTime * animationSpeedRef.current
    material.uniforms.uTime.value = animTime
    material.uniforms.uNormalDetailTime.value = animTime
    material.uniforms.uBaseNormalTime.value = animTime
    material.uniforms.uEdgeRippleTime.value = animTime
  })

  const handleWaterPreviewMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!placementPreviewEnabled || !onPreviewMove) return
      if (event.buttons !== 0) return
      event.stopPropagation()
      onPreviewMove(event.point, false)
    },
    [onPreviewMove, placementPreviewEnabled],
  )

  const waterY = waterClipY
  const waterPosition: [number, number, number] = [waterNudge.x, waterY, waterNudge.y]

  if (!water.enabled) return null

  const needsTransparency =
    water.opacity < 0.99 ||
    water.edgeFade > 0.001 ||
    (water.shorelineFadeDistance > 0.001 && water.shorelineFadeStrength > 0.001)

  return (
    <>
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={waterPosition}
        renderOrder={-1}
      >
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={waterVertexShader}
          fragmentShader={waterFragmentShader}
          transparent={needsTransparency}
          depthWrite={!needsTransparency}
        />
      </mesh>

      {placementPreviewEnabled && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={waterPosition}
          renderOrder={2}
          onPointerMove={handleWaterPreviewMove}
        >
          <planeGeometry args={[planeSize, planeSize]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
    </>
  )
}
