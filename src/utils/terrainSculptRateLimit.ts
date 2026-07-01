import type { RateLimitSettings, TerrainSculptRateLimit } from '../types/sandbox'

export function getTerrainSculptRateLimit(rateLimit: RateLimitSettings): TerrainSculptRateLimit {
  return rateLimit.terrainSculpt
}

export function pruneStrokeTimestamps(timestamps: number[], windowMinutes: number, now = Date.now()): number[] {
  const windowMs = windowMinutes * 60_000
  return timestamps.filter((t) => now - t < windowMs)
}

export function canApplySculptStroke(
  rateLimit: RateLimitSettings,
  strokeTimestamps: number[],
  isExempt: boolean,
  now = Date.now(),
): boolean {
  if (isExempt) return true

  const limits = getTerrainSculptRateLimit(rateLimit)
  if (!rateLimit.enabled || !limits.enabled) return true

  const recent = pruneStrokeTimestamps(strokeTimestamps, limits.windowMinutes, now)
  return recent.length < limits.maxStrokes
}

export function recordSculptStrokeTimestamp(
  strokeTimestamps: number[],
  windowMinutes: number,
  now = Date.now(),
): number[] {
  return [...pruneStrokeTimestamps(strokeTimestamps, windowMinutes, now), now]
}

export function sculptCooldownSeconds(
  rateLimit: RateLimitSettings,
  strokeTimestamps: number[],
  isExempt: boolean,
  now = Date.now(),
): number {
  if (isExempt) return 0

  const limits = getTerrainSculptRateLimit(rateLimit)
  if (!rateLimit.enabled || !limits.enabled) return 0

  const recent = pruneStrokeTimestamps(strokeTimestamps, limits.windowMinutes, now)
  if (recent.length < limits.maxStrokes) return 0

  const oldest = Math.min(...recent)
  const unlockAt = oldest + limits.windowMinutes * 60_000
  return Math.max(0, Math.ceil((unlockAt - now) / 1000))
}
