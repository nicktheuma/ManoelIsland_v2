import type { CameraSettings } from '../types/sandbox'

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  position: [80, 60, 80],
  target: [0, 0, 0],
  fov: 50,
  minDistance: 25,
  maxDistance: 180,
  maxPolarAngleDeg: 87,
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function normalizeVec3(
  value: [number, number, number] | undefined,
  fallback: [number, number, number],
): [number, number, number] {
  if (!value || value.length !== 3) return fallback
  return value.map((component, index) =>
    Number.isFinite(component) ? component : fallback[index],
  ) as [number, number, number]
}

export function normalizeCameraSettings(
  value: Partial<CameraSettings> | null | undefined,
): CameraSettings {
  return {
    position: normalizeVec3(value?.position, DEFAULT_CAMERA_SETTINGS.position),
    target: normalizeVec3(value?.target, DEFAULT_CAMERA_SETTINGS.target),
    fov: clamp(value?.fov ?? DEFAULT_CAMERA_SETTINGS.fov, 20, 100, DEFAULT_CAMERA_SETTINGS.fov),
    minDistance: clamp(
      value?.minDistance ?? DEFAULT_CAMERA_SETTINGS.minDistance,
      5,
      500,
      DEFAULT_CAMERA_SETTINGS.minDistance,
    ),
    maxDistance: clamp(
      value?.maxDistance ?? DEFAULT_CAMERA_SETTINGS.maxDistance,
      10,
      2000,
      DEFAULT_CAMERA_SETTINGS.maxDistance,
    ),
    maxPolarAngleDeg: clamp(
      value?.maxPolarAngleDeg ?? DEFAULT_CAMERA_SETTINGS.maxPolarAngleDeg,
      30,
      90,
      DEFAULT_CAMERA_SETTINGS.maxPolarAngleDeg,
    ),
  }
}
