import type { AuthProfile } from '../types'
import type { TourPoint } from './generate/types'
import GeneratePage from './generate/GeneratePage'

export default function RouteGenerator(props: { profile: AuthProfile; onPickRoute: (points: TourPoint[]) => void }) {
  return <GeneratePage profile={props.profile} onPickRoute={props.onPickRoute} />
}

