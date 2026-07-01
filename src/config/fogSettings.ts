import type { FogSettings } from '../types/sandbox'

export const FOG_NEAR_MIN = 1
export const FOG_NEAR_MAX = 3000
export const FOG_FAR_MIN = 50
export const FOG_FAR_MAX = 10000

export const DEFAULT_FOG_SETTINGS: FogSettings = {
  enabled: true,
  color: '#0f4cf5',
  near: 93,
  far: 467,
  matchBackground: true,
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function normalizeFogSettings(value: Partial<FogSettings> | null | undefined): FogSettings {
  const near = clamp(value?.near ?? DEFAULT_FOG_SETTINGS.near, FOG_NEAR_MIN, FOG_NEAR_MAX, DEFAULT_FOG_SETTINGS.near)
  const far = clamp(
    value?.far ?? DEFAULT_FOG_SETTINGS.far,
    near + 5,
    FOG_FAR_MAX,
    Math.max(DEFAULT_FOG_SETTINGS.far, near + 5),
  )

  return {
    enabled: value?.enabled ?? DEFAULT_FOG_SETTINGS.enabled,
    color: value?.color ?? DEFAULT_FOG_SETTINGS.color,
    near,
    far,
    matchBackground: value?.matchBackground ?? DEFAULT_FOG_SETTINGS.matchBackground,
  }
}

export function resolveFogColor(fog: FogSettings, backgroundColor: string): string {
  return fog.matchBackground ? backgroundColor : fog.color
}

/** Camera far must reach at least fog far or distant fog never appears in the render. */
export function effectiveCameraFarForFog(cameraFar: number, fog: FogSettings): number {
  if (!fog.enabled) return cameraFar
  return Math.max(cameraFar, fog.far + 10)
}
