import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { normalizeSceneAppearance } from '../config/sceneAppearance'
import { resolveFogColor } from '../config/fogSettings'
import { hexToVec3, waterMeshSegments, waterStyleIndex } from '../config/waterSettings'
import { useSandbox } from '../context/SandboxProvider'
import { waterFragmentShader, waterVertexShader } from '../shaders/waterShader'

type AnimatedWaterProps = {
  placementPreviewEnabled?: boolean
  onPreviewMove?: (point: THREE.Vector3, valid: boolean) => void
}

export function AnimatedWater({
  placementPreviewEnabled = false,
  onPreviewMove,
}: AnimatedWaterProps = {}) {
  const { settings } = useSandbox()
  const water = normalizeSceneAppearance(settings.sceneAppearance).water
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const animationSpeedRef = useRef(water.animationSpeed)

  const segments = waterMeshSegments(water.meshQuality)

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(water.planeSize, water.planeSize, segments, segments),
    [segments, water.planeSize],
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWaveHeight: { value: water.waveHeight },
      uWaveIntensity: { value: water.waveIntensity },
      uWaveRandomness: { value: water.waveRandomness },
      uWaveSeed: { value: water.waveSeed },
      uWaveScale: { value: water.waveScale },
      uDetailLayers: { value: water.detailLayers },
      uDetailScale: { value: water.detailScale },
      uDetailStrength: { value: water.detailStrength },
      uStyle: { value: waterStyleIndex(water.style) },
      uColor: { value: new THREE.Color(...hexToVec3(water.color)) },
      uOpacity: { value: water.opacity },
      uMetalness: { value: water.metalness },
      uRoughness: { value: water.roughness },
      uSunDirection: { value: new THREE.Vector3(0.55, 0.85, 0.35).normalize() },
      uFogEnabled: { value: 0 },
      uFogColor: { value: new THREE.Color('#0c1222') },
      uFogNear: { value: 70 },
      uFogFar: { value: 210 },
      uPlaneHalfSize: { value: water.planeSize / 2 },
      uEdgeFade: { value: water.edgeFade },
    }),
    [water.planeSize],
  )

  useEffect(() => {
    animationSpeedRef.current = water.animationSpeed
  }, [water.animationSpeed])

  useEffect(() => {
    const material = materialRef.current
    if (!material) return

    const appearance = normalizeSceneAppearance(settings.sceneAppearance)
    const { fog, backgroundColor } = appearance
    const currentWater = appearance.water

    material.uniforms.uWaveHeight.value = currentWater.waveHeight
    material.uniforms.uWaveIntensity.value = currentWater.waveIntensity
    material.uniforms.uWaveRandomness.value = currentWater.waveRandomness
    material.uniforms.uWaveSeed.value = currentWater.waveSeed
    material.uniforms.uWaveScale.value = currentWater.waveScale
    material.uniforms.uDetailLayers.value = currentWater.detailLayers
    material.uniforms.uDetailScale.value = currentWater.detailScale
    material.uniforms.uDetailStrength.value = currentWater.detailStrength
    material.uniforms.uStyle.value = waterStyleIndex(currentWater.style)
    material.uniforms.uColor.value.set(...hexToVec3(currentWater.color))
    material.uniforms.uOpacity.value = currentWater.opacity
    material.uniforms.uMetalness.value = currentWater.metalness
    material.uniforms.uRoughness.value = currentWater.roughness
    material.uniforms.uPlaneHalfSize.value = currentWater.planeSize / 2
    material.uniforms.uEdgeFade.value = currentWater.edgeFade

    if (fog.enabled) {
      material.uniforms.uFogEnabled.value = 1
      material.uniforms.uFogColor.value.set(resolveFogColor(fog, backgroundColor))
      material.uniforms.uFogNear.value = fog.near
      material.uniforms.uFogFar.value = fog.far
    } else {
      material.uniforms.uFogEnabled.value = 0
    }
  }, [settings.sceneAppearance])

  useFrame((state) => {
    const material = materialRef.current
    if (!material) return
    material.uniforms.uTime.value = state.clock.elapsedTime * animationSpeedRef.current
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

  if (!water.enabled) return null

  const needsTransparency = water.opacity < 0.99 || water.edgeFade > 0.001

  return (
    <>
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, water.level, 0]}
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
          position={[0, water.level, 0]}
          visible={false}
          onPointerMove={handleWaterPreviewMove}
        >
          <planeGeometry args={[water.planeSize, water.planeSize]} />
        </mesh>
      )}
    </>
  )
}
