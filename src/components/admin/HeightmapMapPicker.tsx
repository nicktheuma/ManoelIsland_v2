import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLng } from '../../types/sandbox'
import { bboxFromPolygon } from '../../utils/geo'

const MANOEL_CENTER: LatLng = [35.904, 14.502]

type HeightmapMapPickerProps = {
  polygon: LatLng[]
  drawingEnabled: boolean
  onAddPoint: (point: LatLng) => void
}

export function HeightmapMapPicker({ polygon, drawingEnabled, onAddPoint }: HeightmapMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const onAddPointRef = useRef(onAddPoint)
  const drawingEnabledRef = useRef(drawingEnabled)

  onAddPointRef.current = onAddPoint
  drawingEnabledRef.current = drawingEnabled

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: MANOEL_CENTER,
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    const layerGroup = L.layerGroup().addTo(map)
    mapRef.current = map
    layerGroupRef.current = layerGroup

    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!drawingEnabledRef.current) return
      onAddPointRef.current([event.latlng.lat, event.latlng.lng])
    })

    return () => {
      map.remove()
      mapRef.current = null
      layerGroupRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layerGroup = layerGroupRef.current
    if (!map || !layerGroup) return

    layerGroup.clearLayers()

    if (polygon.length === 0) {
      L.circleMarker(MANOEL_CENTER, {
        radius: 4,
        color: '#38bdf8',
        fillColor: '#38bdf8',
        fillOpacity: 0.8,
        weight: 1,
      })
        .bindTooltip('Manoel Island, Malta', { permanent: false })
        .addTo(layerGroup)
      return
    }

    const latLngs = polygon.map(([lat, lng]) => L.latLng(lat, lng))

    polygon.forEach(([lat, lng], index) => {
      L.circleMarker([lat, lng], {
        radius: 5,
        color: '#fbbf24',
        fillColor: '#fbbf24',
        fillOpacity: 0.9,
        weight: 1,
      })
        .bindTooltip(`Point ${index + 1}`, { permanent: false })
        .addTo(layerGroup)
    })

    if (polygon.length >= 2) {
      L.polyline(latLngs, { color: '#38bdf8', weight: 2, dashArray: '6 4' }).addTo(layerGroup)
    }

    if (polygon.length >= 3) {
      L.polygon(latLngs, {
        color: '#22d3ee',
        weight: 2,
        fillColor: '#22d3ee',
        fillOpacity: 0.15,
      }).addTo(layerGroup)
    }

    const bounds = bboxFromPolygon(polygon)
    map.fitBounds(
      L.latLngBounds(
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ),
      { padding: [24, 24], maxZoom: 16 },
    )
  }, [polygon])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (drawingEnabled) {
      map.getContainer().style.cursor = 'crosshair'
    } else {
      map.getContainer().style.cursor = ''
    }
  }, [drawingEnabled])

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-700">
      <div ref={containerRef} className="h-56 w-full bg-slate-900" />
      {drawingEnabled && (
        <p className="absolute bottom-2 left-2 rounded bg-slate-950/80 px-2 py-1 text-[11px] text-cyan-200">
          Click map to add outline points
        </p>
      )}
    </div>
  )
}
