import * as THREE from 'three'
import type { PropDefinition, PropVariationConfig } from '../types/propLibrary'

export function createDefaultVariation(
  defaultColor: string,
  defaultScale: number,
): PropVariationConfig {
  const color = new THREE.Color(defaultColor)
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)

  const darker = new THREE.Color().setHSL(hsl.h, Math.max(0, hsl.s - 0.1), Math.max(0, hsl.l - 0.12))
  const lighter = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s + 0.05), Math.min(1, hsl.l + 0.12))

  return {
    enabled: false,
    scaleMin: Math.max(0.25, defaultScale * 0.85),
    scaleMax: defaultScale * 1.15,
    colorMin: `#${darker.getHexString()}`,
    colorMax: `#${lighter.getHexString()}`,
  }
}

export function randomInRange(min: number, max: number): number {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  return lo + Math.random() * (hi - lo)
}

export function randomColorBetween(minColor: string, maxColor: string): string {
  const min = new THREE.Color(minColor)
  const max = new THREE.Color(maxColor)
  const result = new THREE.Color()
  result.lerpColors(min, max, Math.random())
  return `#${result.getHexString()}`
}

export function resolvePropVariation(definition: PropDefinition): {
  color: string
  scale: number
} {
  if (!definition.variation.enabled) {
    return {
      color: definition.defaultColor,
      scale: definition.defaultScale,
    }
  }

  return {
    color: randomColorBetween(definition.variation.colorMin, definition.variation.colorMax),
    scale: randomInRange(definition.variation.scaleMin, definition.variation.scaleMax),
  }
}
