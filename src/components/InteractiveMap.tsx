import { useLocation } from 'react-router-dom'

import type { AuthProfile } from '../types'
import Map from './Map'

export default function InteractiveMap(props: { profile: AuthProfile }) {
  const location = useLocation()

  // Маршрут передаётся из раздела генерации через navigation state.
  const routePlaceIds = (location.state as any)?.placeIds as string[] | undefined

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Map profile={props.profile} initialRoutePlaceIds={routePlaceIds} />
    </div>
  )
}

