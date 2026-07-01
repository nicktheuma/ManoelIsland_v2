import { useCallback, useEffect, useMemo, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MOUSE, TOUCH } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useAdmin } from '../context/AdminProvider'
import { useSandbox } from '../context/SandboxProvider'
import type { CameraSettings } from '../types/sandbox'

function positionTargetKey(camera: CameraSettings) {
  return `${camera.position.join(',')}|${camera.target.join(',')}`
}

type SandboxOrbitControlsProps = {
  camera: CameraSettings
  enabled: boolean
  /** When true, left click is used by tools — rotate with right drag, zoom with scroll. */
  reservePrimaryPointer?: boolean
}

export function SandboxOrbitControls({ camera, enabled, reservePrimaryPointer = false }: SandboxOrbitControlsProps) {
  const defaultCamera = useThree((state) => state.camera)
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const appliedPositionTargetKeyRef = useRef<string | null>(null)
  const { registerCameraCapture } = useSandbox()
  const { isAdmin } = useAdmin()

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
    defaultCamera.near = camera.near
    defaultCamera.far = camera.far
    defaultCamera.updateProjectionMatrix()
  }, [camera.fov, camera.near, camera.far, defaultCamera])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    if (isAdmin) {
      controls.minDistance = 0.25
      controls.maxDistance = 2500
      controls.maxPolarAngle = Math.PI
    } else {
      controls.minDistance = camera.minDistance
      controls.maxDistance = camera.maxDistance
      controls.maxPolarAngle = (camera.maxPolarAngleDeg * Math.PI) / 180
    }
  }, [isAdmin, camera.minDistance, camera.maxDistance, camera.maxPolarAngleDeg])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    if (reservePrimaryPointer) {
      controls.mouseButtons = {
        MIDDLE: MOUSE.PAN,
        RIGHT: MOUSE.ROTATE,
      }
      controls.touches = {
        ONE: TOUCH.PAN,
        TWO: TOUCH.DOLLY_PAN,
      }
    } else {
      controls.mouseButtons = {
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.PAN,
        RIGHT: MOUSE.PAN,
      }
      controls.touches = {
        ONE: TOUCH.ROTATE,
        TWO: TOUCH.DOLLY_PAN,
      }
    }
  }, [reservePrimaryPointer])

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
