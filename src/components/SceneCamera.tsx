import { useCallback, useEffect, useMemo, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useSandbox } from '../context/SandboxProvider'
import type { CameraSettings } from '../types/sandbox'

function positionTargetKey(camera: CameraSettings) {
  return `${camera.position.join(',')}|${camera.target.join(',')}`
}

type SandboxOrbitControlsProps = {
  camera: CameraSettings
  enabled: boolean
}

export function SandboxOrbitControls({ camera, enabled }: SandboxOrbitControlsProps) {
  const defaultCamera = useThree((state) => state.camera)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const appliedPositionTargetKeyRef = useRef<string | null>(null)
  const { registerCameraCapture } = useSandbox()

  const positionTargetKeyValue = useMemo(
    () => positionTargetKey(camera),
    [camera.position[0], camera.position[1], camera.position[2], camera.target[0], camera.target[1], camera.target[2]],
  )

  const applyPositionAndTarget = useCallback(() => {
    defaultCamera.position.set(camera.position[0], camera.position[1], camera.position[2])

    const controls = controlsRef.current
    if (controls) {
      controls.target.set(camera.target[0], camera.target[1], camera.target[2])
      controls.update()
    } else {
      defaultCamera.lookAt(camera.target[0], camera.target[1], camera.target[2])
    }

    appliedPositionTargetKeyRef.current = positionTargetKeyValue
  }, [camera.position, camera.target, defaultCamera, positionTargetKeyValue])

  useEffect(() => {
    if (appliedPositionTargetKeyRef.current === positionTargetKeyValue) return

    let cancelled = false

    const apply = () => {
      if (cancelled) return
      applyPositionAndTarget()
      if (!controlsRef.current) {
        requestAnimationFrame(apply)
      }
    }

    apply()

    return () => {
      cancelled = true
    }
  }, [positionTargetKeyValue, applyPositionAndTarget])

  useEffect(() => {
    if (!(defaultCamera instanceof THREE.PerspectiveCamera)) return
    defaultCamera.fov = camera.fov
    defaultCamera.updateProjectionMatrix()
  }, [camera.fov, defaultCamera])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.minDistance = camera.minDistance
    controls.maxDistance = camera.maxDistance
    controls.maxPolarAngle = (camera.maxPolarAngleDeg * Math.PI) / 180
  }, [camera.minDistance, camera.maxDistance, camera.maxPolarAngleDeg])

  useEffect(() => {
    registerCameraCapture(() => {
      const controls = controlsRef.current
      if (!controls) return null

      const pos = defaultCamera.position
      const tgt = controls.target
      const fov = defaultCamera instanceof THREE.PerspectiveCamera ? defaultCamera.fov : camera.fov

      return {
        position: [pos.x, pos.y, pos.z],
        target: [tgt.x, tgt.y, tgt.z],
        fov,
      }
    })

    return () => registerCameraCapture(null)
  }, [registerCameraCapture, defaultCamera, camera.fov])

  return <OrbitControls ref={controlsRef} makeDefault enabled={enabled} />
}
