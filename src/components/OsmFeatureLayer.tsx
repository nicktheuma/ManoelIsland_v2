import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OsmFeatureData } from '../utils/osmFeatures3d'
import type { TerrainLayerNudge } from '../types/sandbox'
import { layerNudgeToGroupTransform } from '../utils/terrainLayerNudge'

type OsmFeatureLayerProps = {
  data: OsmFeatureData | null
  enabled: boolean
  nudge?: TerrainLayerNudge
}

const BUILDING_COLOR = '#c9bfb0'
const TREE_TRUNK = '#6b4423'
const TREE_CANOPY = '#3d7a3d'

export function OsmFeatureLayer({ data, enabled, nudge }: OsmFeatureLayerProps) {
  const buildingMeshRef = useRef<THREE.InstancedMesh>(null)
  const treeTrunkRef = useRef<THREE.InstancedMesh>(null)
  const treeCanopyRef = useRef<THREE.InstancedMesh>(null)

  const buildingGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const trunkGeometry = useMemo(() => new THREE.CylinderGeometry(0.12, 0.16, 1.2, 6), [])
  const canopyGeometry = useMemo(() => new THREE.ConeGeometry(0.55, 1.4, 8), [])

  useEffect(
    () => () => {
      buildingGeometry.dispose()
      trunkGeometry.dispose()
      canopyGeometry.dispose()
    },
    [buildingGeometry, trunkGeometry, canopyGeometry],
  )

  useEffect(() => {
    const mesh = buildingMeshRef.current
    if (!mesh || !data) return

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    for (let i = 0; i < data.buildings.length; i++) {
      const building = data.buildings[i]
      position.set(building.x, building.y, building.z)
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), building.rotation)
      scale.set(building.width, building.height, building.depth)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(i, matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
  }, [data])

  useEffect(() => {
    const trunkMesh = treeTrunkRef.current
    const canopyMesh = treeCanopyRef.current
    if (!trunkMesh || !canopyMesh || !data) return

    const matrix = new THREE.Matrix4()
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    for (let i = 0; i < data.trees.length; i++) {
      const tree = data.trees[i]
      const s = tree.scale

      position.set(tree.x, tree.y + 0.6 * s, tree.z)
      quaternion.identity()
      scale.set(s, s, s)
      matrix.compose(position, quaternion, scale)
      trunkMesh.setMatrixAt(i, matrix)

      position.set(tree.x, tree.y + 1.5 * s, tree.z)
      matrix.compose(position, quaternion, scale)
      canopyMesh.setMatrixAt(i, matrix)
    }

    trunkMesh.instanceMatrix.needsUpdate = true
    canopyMesh.instanceMatrix.needsUpdate = true
  }, [data])

  if (!enabled || !data || (data.buildings.length === 0 && data.trees.length === 0)) {
    return null
  }

  const { position, scale } = layerNudgeToGroupTransform(nudge ?? { x: 0, y: 0, scaleX: 1, scaleY: 1 })

  return (
    <group position={position} scale={scale}>
      {data.buildings.length > 0 && (
        <instancedMesh
          ref={buildingMeshRef}
          args={[buildingGeometry, undefined, data.buildings.length]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={BUILDING_COLOR} roughness={0.85} metalness={0.05} />
        </instancedMesh>
      )}

      {data.trees.length > 0 && (
        <>
          <instancedMesh ref={treeTrunkRef} args={[trunkGeometry, undefined, data.trees.length]} castShadow>
            <meshStandardMaterial color={TREE_TRUNK} roughness={0.9} />
          </instancedMesh>
          <instancedMesh ref={treeCanopyRef} args={[canopyGeometry, undefined, data.trees.length]} castShadow>
            <meshStandardMaterial color={TREE_CANOPY} roughness={0.75} />
          </instancedMesh>
        </>
      )}
    </group>
  )
}
