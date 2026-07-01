import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneAppearanceForRender } from '../config/sceneAppearance'
import { resolveFogColor } from '../config/fogSettings'
import { useSandbox } from '../context/SandboxProvider'

export function SceneFog() {
  const { scene } = useThree()
  const { settings } = useSandbox()
  const appearance = sceneAppearanceForRender(settings.sceneAppearance)

  useLayoutEffect(() => {
    const { fog, backgroundColor } = appearance

    if (!fog.enabled) {
      scene.fog = null
      return
    }

    const color = resolveFogColor(fog, backgroundColor)
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(color)
      scene.fog.near = fog.near
      scene.fog.far = fog.far
    } else {
      scene.fog = new THREE.Fog(color, fog.near, fog.far)
    }

    return () => {
      scene.fog = null
    }
  }, [
    appearance.backgroundColor,
    appearance.fog.color,
    appearance.fog.enabled,
    appearance.fog.far,
    appearance.fog.matchBackground,
    appearance.fog.near,
    scene,
  ])

  return null
}
