import { useEffect, useMemo, useState } from 'react'
import type { AuthProfile } from '../types'
import type { Location } from '../data/locations'
import { TAG_CHIPS, getMatchedTagChipIds } from '../utils/tagChips'

import { AnimatePresence, motion } from 'framer-motion'

function getPhotos(place: Location) {
  const base = place.photos?.length ? place.photos : [place.photoUrl]
  // MVP: UI рассчитан на 5–8 фото, поэтому если фото меньше — дублируем (для демо не падаем).
  if (base.length >= 5) return base
  return Array.from({ length: 6 }, (_, i) => base[i % base.length]!)
}

export default function PlaceSidePanel(props: {
  open: boolean
  profile: AuthProfile
  place: Location | null
  onClose: () => void
  onMore: () => void
  onAtmosphere: () => void
}) {
  const { open, place, profile } = props
  const [photoIdx, setPhotoIdx] = useState(0)

  const photos = useMemo(() => {
    if (!place) return []
    return getPhotos(place)
  }, [place])

  const matchedTagIds = useMemo(() => {
    if (!place?.id || !profile.interests) return []
    return getMatchedTagChipIds(place, profile.interests)
  }, [place, profile.interests])

  const matchedTags = useMemo(() => {
    const set = new Set(matchedTagIds)
    return TAG_CHIPS.filter((t) => set.has(t.id))
  }, [matchedTagIds])

  // Сброс слайдера при смене места
  useEffect(() => {
    setPhotoIdx(0)
  }, [place?.id])

  return (
    <AnimatePresence>
      {open && place && (
        <motion.aside
          className="sidePanel"
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 30, opacity: 0 }}
        >
          <div className="sidePanelTopRow">
            <div>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>{place.name}</div>
              <div style={{ opacity: 0.75, marginTop: 6 }}>Локация • {place.placeTypes.join(', ')}</div>
            </div>
            <button type="button" className="iconBtn" onClick={props.onClose} aria-label="Закрыть">
              Закрыть
            </button>
          </div>

          <div className="photoSlider">
            <img src={photos[photoIdx] ?? place.photoUrl} alt={`Фото: ${place.name}`} className="photoSliderImg" />
            <div className="sliderControls">
              <button
                type="button"
                className="secondaryBtn"
                style={{ padding: '8px 12px', height: 36 }}
                onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
              >
                Назад
              </button>
              <div className="sliderPill">
                Фото {photoIdx + 1}/{photos.length}
              </div>
              <button
                type="button"
                className="secondaryBtn"
                style={{ padding: '8px 12px', height: 36 }}
                onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
              >
                Далее
              </button>
            </div>
          </div>

          <div className="placeDesc">{place.description}</div>
          <div style={{ marginTop: 10, opacity: 0.82, lineHeight: 1.35 }}>
            <div style={{ fontWeight: 850 }}>Адрес</div>
            <div>{place.address ?? 'Адрес уточняется. (MVP: заглушка)'}</div>
          </div>
          <div style={{ marginTop: 10, opacity: 0.82, lineHeight: 1.35 }}>
            <div style={{ fontWeight: 850 }}>Как добраться</div>
            <div>{place.howToGet ?? 'Подъедем по маршруту. (MVP: заглушка)'}</div>
          </div>

          <div className="tagsRow" aria-label="Теги места">
            {matchedTags.length ? (
              matchedTags.map((t) => (
                <span key={t.id} className="tagBadge matched">
                  {t.label}
                </span>
              ))
            ) : (
              <div style={{ opacity: 0.7, marginTop: 10 }}>Под интересы пока не найдено точных тегов.</div>
            )}
          </div>

          <div className="panelActions">
            <button type="button" className="primaryBtn secondaryBtnWide" onClick={props.onMore}>
              Подробнее
            </button>
            <button type="button" className="accentBtn secondaryBtnWide" onClick={props.onAtmosphere}>
              Окунуться в атмосферу места
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

