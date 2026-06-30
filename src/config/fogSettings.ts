import type { FogSettings } from '../types/sandbox'

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
  const near = clamp(value?.near ?? DEFAULT_FOG_SETTINGS.near, 1, 400, DEFAULT_FOG_SETTINGS.near)
  const far = clamp(
    value?.far ?? DEFAULT_FOG_SETTINGS.far,
    near + 5,
    500,
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
