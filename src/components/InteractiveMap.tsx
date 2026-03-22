import { useLocation } from 'react-router-dom'

import type { AuthProfile } from '../types'
import type { TourPoint } from './generate/types'
import Map from './Map'

export default function InteractiveMap(props: { profile: AuthProfile }) {
  const location = useLocation()

  const tourPoints = (location.state as any)?.tourPoints as TourPoint[] | undefined
  const routePlaceIds = (location.state as any)?.placeIds as string[] | undefined

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Map profile={props.profile} initialRoutePlaceIds={routePlaceIds} initialTourPoints={tourPoints} />
    </div>
  )
}

