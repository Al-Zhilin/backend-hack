import { PlaceCardModal } from '../PlaceCard'
import type { TourPoint } from './types'

export default function PlaceModal(props: {
  open: boolean
  point: TourPoint | null
  onClose: () => void
}) {
  if (!props.point) return null

  return (
    <PlaceCardModal
      open={props.open}
      onClose={props.onClose}
      name={props.point.name}
      description={props.point.description}
      photos={props.point.photos?.length ? props.point.photos : props.point.photoUrl ? [props.point.photoUrl] : []}
      address={props.point.address}
      phone={props.point.phone}
      website={props.point.website}
      tags={props.point.tags}
      prices={props.point.prices}
      seasonality={props.point.seasonality}
      workingHours={props.point.workingHours}
      lat={props.point.lat}
      lng={props.point.lng}
    />
  )
}
