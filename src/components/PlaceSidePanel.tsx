import { useMemo } from 'react'
import type { AuthProfile } from '../types'
import type { Location } from '../data/locations'
import { PlaceCardFull, locationToCardProps } from './PlaceCard'
import { TAG_CHIPS, getMatchedTagChipIds } from '../utils/tagChips'

import { AnimatePresence, motion } from 'framer-motion'
import { useVerticalSwipeDown } from '../hooks/useSwipeGesture'

export default function PlaceSidePanel(props: {
  open: boolean
  profile: AuthProfile
  place: Location | null
  onClose: () => void
  onMore: () => void
  onAtmosphere: () => void
  routePlaceIds?: string[]
  onRouteAdd?: (placeId: string) => void
  onRouteRemove?: (placeId: string) => void
}) {
  const { open, place, profile } = props

  const matchedTagIds = useMemo(() => {
    if (!place?.id || !profile.interests) return []
    return getMatchedTagChipIds(place, profile.interests)
  }, [place, profile.interests])

  const matchedTags = useMemo(() => {
    const set = new Set(matchedTagIds)
    return TAG_CHIPS.filter((t) => set.has(t.id))
  }, [matchedTagIds])

  const cardProps = useMemo(() => {
    if (!place) return null
    const base = locationToCardProps(place)
    return {
      ...base,
      tourTags: matchedTags.map((t) => t.label),
    }
  }, [place, matchedTags])

  const swipeClose = useVerticalSwipeDown(props.onClose, 80)

  return (
    <AnimatePresence>
      {open && place && cardProps && (
        <motion.aside
          className="sidePanel"
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 30, opacity: 0 }}
        >
          <div className="sidePanelDragHandle" {...swipeClose} role="presentation" aria-label="Свайп вниз, чтобы закрыть">
            <div className="sidePanelDragHandleBar" />
          </div>
          <PlaceCardFull
            {...cardProps}
            placeId={place.id}
            routeInRoute={props.routePlaceIds?.includes(place.id)}
            onRouteAdd={props.onRouteAdd ? () => props.onRouteAdd!(place.id) : undefined}
            onRouteRemove={props.onRouteRemove ? () => props.onRouteRemove!(place.id) : undefined}
            onClose={props.onClose}
            onMore={props.onMore}
            onAtmosphere={props.onAtmosphere}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
