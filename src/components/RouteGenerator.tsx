import type { AuthProfile } from '../types'
import GeneratePage from './generate/GeneratePage'

export default function RouteGenerator(props: { profile: AuthProfile; onPickRoute: (placeIds: string[]) => void }) {
  return <GeneratePage profile={props.profile} onPickRoute={props.onPickRoute} />
}

