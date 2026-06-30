import { PropMesh } from './PropMesh'
import type { PropType } from '../types/props'

type PropPreviewProps = {
  type: PropType
  position: [number, number, number]
}

export function PropPreview({ type, position }: PropPreviewProps) {
  return <PropMesh type={type} position={position} preview />
}
