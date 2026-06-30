import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useSandbox } from '../context/SandboxProvider'
import { useAdmin } from '../context/AdminProvider'
import { useTerrainHeight } from '../context/TerrainHeightProvider'

const LINE_PROPS = {
  depthTest: false,
  transparent: true,
  renderOrder: 1000,
} as const

function projectPolygon(
  points: [number, number][],
  projectOntoTerrain: (x: number, z: number, offset?: number) => [number, number, number],
  offset = 0.2,
): [number, number, number][] {
  return points.map(([x, z]) => projectOntoTerrain(x, z, offset))
}

export function ZoneOverlays() {
  const { settings } = useSandbox()
  const { draftZonePoints, zoneDrawingMode } = useAdmin()
  const { projectOntoTerrain } = useTerrainHeight()
  const showZones = settings.userVisibility.showZoneOverlays || zoneDrawingMode

  const draftLinePoints = useMemo(() => {
    if (!zoneDrawingMode || draftZonePoints.length === 0) return []
    return projectPolygon(draftZonePoints, projectOntoTerrain, 0.25)
  }, [draftZonePoints, projectOntoTerrain, zoneDrawingMode])

  if (!showZones && !zoneDrawingMode) return null

  return (
    <>
      {settings.zones.map((zone) => {
        if (zone.points.length < 2) return null
        const elevated = projectPolygon(zone.points, projectOntoTerrain, 0.2)
        const closed = [...elevated, elevated[0]]
        return (
          <Line
            key={zone.id}
            points={closed}
            color={zone.color}
            lineWidth={2}
            opacity={0.9}
            {...LINE_PROPS}
          />
        )
      })}

      {draftLinePoints.length > 0 && (
        <Line
          points={draftLinePoints}
          color="#fbbf24"
          lineWidth={3}
          opacity={1}
          {...LINE_PROPS}
        />
      )}
    </>
  )
}
