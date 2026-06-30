import { PropMesh } from './PropMesh'
import type { PlacedProp } from '../types/props'

type PlacedPropsProps = {
  placedProps: PlacedProp[]
}

export function PlacedProps({ placedProps }: PlacedPropsProps) {
  return (
    <>
      {placedProps.map((prop) => (
        <PropMesh key={prop.id} type={prop.type} position={prop.position} />
      ))}
    </>
  )
}
