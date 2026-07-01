export type LatLng = [number, number]

export type GeoBounds = {
  north: number
  south: number
  east: number
  west: number
}

export function bboxFromPolygon(polygon: LatLng[]): GeoBounds {
  let north = -Infinity
  let south = Infinity
  let east = -Infinity
  let west = Infinity

  for (const [lat, lng] of polygon) {
    north = Math.max(north, lat)
    south = Math.min(south, lat)
    east = Math.max(east, lng)
    west = Math.min(west, lng)
  }

  return { north, south, east, west }
}

export function pointInPolygon(lat: number, lng: number, polygon: LatLng[]): boolean {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]
    const [yj, xj] = polygon[j]
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi
    if (intersects) inside = !inside
  }

  return inside
}

export function hashPolygon(polygon: LatLng[], version: number): string {
  const payload = `${version}:${polygon.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join('|')}`
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 31 + payload.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number; z: number } {
  const scale = 2 ** zoom
  const x = Math.floor(((lng + 180) / 360) * scale)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  )
  return { x, y, z: zoom }
}

export function latLngToTilePixel(
  lat: number,
  lng: number,
  zoom: number,
): { tileX: number; tileY: number; pixelX: number; pixelY: number } {
  const scale = 2 ** zoom
  const worldX = ((lng + 180) / 360) * scale * 256
  const latRad = (lat * Math.PI) / 180
  const worldY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale * 256

  const tileX = Math.floor(worldX / 256)
  const tileY = Math.floor(worldY / 256)
  const pixelX = Math.min(255, Math.max(0, Math.floor(worldX - tileX * 256)))
  const pixelY = Math.min(255, Math.max(0, Math.floor(worldY - tileY * 256)))

  return { tileX, tileY, pixelX, pixelY }
}

export function chooseTerrariumZoom(bounds: GeoBounds): number {
  const latSpan = bounds.north - bounds.south
  const lngSpan = bounds.east - bounds.west
  const span = Math.max(latSpan, lngSpan)

  if (span > 0.25) return 11
  if (span > 0.08) return 12
  if (span > 0.03) return 13
  if (span > 0.012) return 14
  if (span > 0.006) return 15
  return 16
}

export function chooseImageryZoom(bounds: GeoBounds): number {
  const span = Math.max(bounds.north - bounds.south, bounds.east - bounds.west)

  if (span > 0.08) return 14
  if (span > 0.03) return 15
  if (span > 0.012) return 16
  if (span > 0.006) return 17
  return 18
}

export function latLngToWorldPixel(
  lat: number,
  lng: number,
  zoom: number,
): { x: number; y: number } {
  const scale = 256 * 2 ** zoom
  const x = ((lng + 180) / 360) * scale
  const latRad = (lat * Math.PI) / 180
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale
  return { x, y }
}

export function latLngToBboxPixel(
  lat: number,
  lng: number,
  bounds: GeoBounds,
  size: number,
): { x: number; y: number } {
  const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * (size - 1)
  const y = ((bounds.north - lat) / (bounds.north - bounds.south)) * (size - 1)
  return { x, y }
}
