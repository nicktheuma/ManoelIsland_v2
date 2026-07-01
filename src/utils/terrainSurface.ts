import * as THREE from 'three'
import type { LatLng, TerrainGeoReference, TerrainSurfaceStyle } from '../types/sandbox'
import { buildOrthophotoSurface, type TileFetchProgress } from './orthophotoSurface'
import { buildSimplifiedSiteMap, type SimplifiedMapProgress } from './simplifiedSiteMap'

export type SurfaceBuildProgress = {
  phase: 'tiles' | 'compositing' | 'fetch' | 'render'
  progress: number
}

const GRID_CELLS = 20

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex

  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function drawGridOverlay(
  ctx: CanvasRenderingContext2D,
  size: number,
  fillColor: string,
  lineColor: string,
  fillOpacity: number,
  cells = GRID_CELLS,
): void {
  if (fillOpacity > 0) {
    ctx.fillStyle = colorWithAlpha(fillColor, fillOpacity * 0.35)
    ctx.fillRect(0, 0, size, size)
  }

  const step = size / cells
  ctx.strokeStyle = colorWithAlpha(lineColor, 0.55)
  ctx.lineWidth = Math.max(1, size / 256)

  for (let i = 0; i <= cells; i++) {
    const pos = i * step
    ctx.beginPath()
    ctx.moveTo(pos, 0)
    ctx.lineTo(pos, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, pos)
    ctx.lineTo(size, pos)
    ctx.stroke()
  }
}

export function applySurfacePresentation(
  source: HTMLCanvasElement,
  options: {
    surfaceOpacity: number
    showGridOverlay: boolean
    fillColor: string
    gridColor: string
    fillOpacity: number
  },
): HTMLCanvasElement {
  const size = source.width
  const output = document.createElement('canvas')
  output.width = size
  output.height = size
  const ctx = output.getContext('2d')
  if (!ctx) throw new Error('Could not prepare terrain surface.')

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = options.fillColor
  ctx.fillRect(0, 0, size, size)
  ctx.globalAlpha = options.surfaceOpacity
  ctx.drawImage(source, 0, 0)
  ctx.globalAlpha = 1

  if (options.showGridOverlay) {
    drawGridOverlay(ctx, size, options.fillColor, options.gridColor, options.fillOpacity)
  }

  return output
}

export function canvasToObjectUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

export function createTextureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export async function buildTerrainSurface(
  polygon: LatLng[],
  size: number,
  geo: TerrainGeoReference,
  style: Exclude<TerrainSurfaceStyle, 'grid'>,
  onProgress?: (progress: SurfaceBuildProgress) => void,
): Promise<{ canvas: HTMLCanvasElement; objectUrl: string; zoom: number | null }> {
  if (style === 'orthophoto') {
    const result = await buildOrthophotoSurface(polygon, size, geo, (progress: TileFetchProgress) => {
      onProgress?.({ phase: progress.phase, progress: progress.progress })
    })
    return { canvas: result.canvas, objectUrl: result.objectUrl, zoom: result.zoom }
  }

  const result = await buildSimplifiedSiteMap(polygon, size, geo, (progress: SimplifiedMapProgress) => {
    onProgress?.({ phase: progress.phase, progress: progress.progress })
  })
  return { canvas: result.canvas, objectUrl: result.objectUrl, zoom: result.zoom }
}
