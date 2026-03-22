import { useCallback, useState } from 'react'
import { useHorizontalSwipe } from '../hooks/useSwipeGesture'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { AnimatePresence, motion } from 'framer-motion'
import { Panorama, YMaps } from '@pbe/react-yandex-maps'
import { YANDEX_MAPS_QUERY } from '../config/yandex'
import type { Location } from '../data/locations'
import { getLocationRussianTags } from '../utils/userTagMapping'
import '../styles/place-card.scss'

export interface PlaceCardProps {
  name: string
  description: string
  photos: string[]
  address?: string
  phone?: string
  website?: string
  tags: string[]
  tourTags?: string[]
  prices?: string
  seasonality?: string[]
  workingHours?: string
  lat: number
  lng: number
  active?: boolean
}

const SEASON_LABELS: Record<string, string> = {
  spring: 'Весна',
  summer: 'Лето',
  autumn: 'Осень',
  winter: 'Зима',
}

function seasonLabel(s: string) {
  return SEASON_LABELS[s] ?? s
}

export function locationToCardProps(loc: Location): PlaceCardProps {
  return {
    name: loc.name,
    photos: loc.photos?.length ? loc.photos : [loc.photoUrl],
    description: loc.aiFullDescription ?? loc.description,
    address: loc.address,
    phone: loc.contacts?.phone,
    website: loc.contacts?.site,
    tags: getLocationRussianTags(loc),
    prices: loc.prices,
    seasonality: loc.seasonality ?? loc.seasons,
    workingHours: loc.workingHours,
    lat: loc.lat,
    lng: loc.lng,
  }
}

/* ────────────────────────────────────────────────────────
   Compact — for grids and horizontal scrolls
   ──────────────────────────────────────────────────────── */

export function PlaceCardCompact(
  props: PlaceCardProps & {
    onAction?: () => void
    actionLabel?: string
  },
) {
  const photo = props.photos[0]

  return (
    <article className={`placeCard${props.active ? ' placeCard--active' : ''}`}>
      {photo && <img className="placeCardImg" src={photo} alt={props.name} />}

      <div className="placeCardBody">
        <div className="placeCardTitle">{props.name}</div>
        <div className="placeCardDesc">{props.description}</div>

        {(props.tourTags?.length || props.tags.length > 0) && (
          <div className="placeCardTags">
            {props.tourTags?.map((t) => (
              <span key={`tour-${t}`} className="placeCardTag placeCardTag--tour">
                {t}
              </span>
            ))}
            {props.tags.map((t) => (
              <span key={t} className="placeCardTag placeCardTag--place">
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="placeCardMeta">
          {props.address && (
            <div className="placeCardMetaRow">
              <span className="placeCardMetaLabel">Адрес:</span> {props.address}
            </div>
          )}
          {props.phone && (
            <div className="placeCardMetaRow">
              <span className="placeCardMetaLabel">Тел:</span>{' '}
              <a href={`tel:${props.phone}`}>{props.phone}</a>
            </div>
          )}
          {props.workingHours && (
            <div className="placeCardMetaRow">
              <span className="placeCardMetaLabel">Часы:</span> {props.workingHours}
            </div>
          )}
          {props.prices && <div className="placeCardPrice">{props.prices}</div>}
        </div>

        {props.seasonality && props.seasonality.length > 0 && (
          <div className="placeCardSeasons">
            {props.seasonality.map((s) => (
              <span key={s} className="placeCardSeason">
                {seasonLabel(s)}
              </span>
            ))}
          </div>
        )}

        {props.onAction && (
          <div className="placeCardActions">
            <button type="button" className="primaryBtn" onClick={props.onAction}>
              {props.actionLabel ?? 'Подробнее'}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

/* ────────────────────────────────────────────────────────
   Full — side panel with photo slider
   ──────────────────────────────────────────────────────── */

export function PlaceCardFull(
  props: PlaceCardProps & {
    onClose?: () => void
    onMore?: () => void
    onAtmosphere?: () => void
  },
) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const photos = props.photos.length ? props.photos : []
  const n = photos.length
  const goNext = useCallback(() => setPhotoIdx((i) => (n > 0 ? (i + 1) % n : 0)), [n])
  const goPrev = useCallback(() => setPhotoIdx((i) => (n > 0 ? (i - 1 + n) % n : 0)), [n])
  const gallerySwipe = useHorizontalSwipe(goNext, goPrev, { threshold: 44 })

  return (
    <div className="placeCardFull">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div className="placeCardTitle">{props.name}</div>
          <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
            {props.address ?? 'Краснодарский край'}
          </div>
        </div>
        {props.onClose && (
          <button type="button" className="iconBtn" onClick={props.onClose}>
            Закрыть
          </button>
        )}
      </div>

      {photos.length > 0 && (
        <div
          className="placeCardFullSlider placeCardFullSlider--swipe"
          {...(photos.length > 1 ? gallerySwipe : {})}
        >
          <img
            className="placeCardFullSliderImg"
            src={photos[photoIdx % photos.length]}
            alt={`Фото: ${props.name}`}
            draggable={false}
          />
          {photos.length > 1 && (
            <div className="placeCardFullSliderControls">
              <button
                type="button"
                className="secondaryBtn"
                style={{ padding: '6px 10px', height: 32 }}
                onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}
              >
                Назад
              </button>
              <span className="placeCardFullSliderPill">
                {(photoIdx % photos.length) + 1}/{photos.length}
              </span>
              <button
                type="button"
                className="secondaryBtn"
                style={{ padding: '6px 10px', height: 32 }}
                onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}
              >
                Далее
              </button>
            </div>
          )}
        </div>
      )}

      <div className="placeCardDesc" style={{ WebkitLineClamp: 'unset' }}>
        {props.description}
      </div>

      {(props.tourTags?.length || props.tags.length > 0) && (
        <div className="placeCardTags">
          {props.tourTags?.map((t) => (
            <span key={`tour-${t}`} className="placeCardTag placeCardTag--tour">
              {t}
            </span>
          ))}
          {props.tags.map((t) => (
            <span key={t} className="placeCardTag placeCardTag--place">
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="placeCardFullSection">
        {props.address && (
          <div className="placeCardFullRow">
            <b>Адрес: </b>
            {props.address}
          </div>
        )}
        {props.phone && (
          <div className="placeCardFullRow">
            <b>Телефон: </b>
            <a href={`tel:${props.phone}`}>{props.phone}</a>
          </div>
        )}
        {props.website && (
          <div className="placeCardFullRow">
            <b>Сайт: </b>
            <a href={props.website.startsWith('http') ? props.website : `https://${props.website}`} target="_blank" rel="noreferrer">
              {props.website}
            </a>
          </div>
        )}
        {props.workingHours && (
          <div className="placeCardFullRow">
            <b>Часы работы: </b>
            {props.workingHours}
          </div>
        )}
        {props.prices && (
          <div className="placeCardFullRow">
            <b>Цены: </b>
            {props.prices}
          </div>
        )}
      </div>

      {props.seasonality && props.seasonality.length > 0 && (
        <div>
          <b style={{ fontSize: 13 }}>Сезонность:</b>
          <div className="placeCardSeasons" style={{ marginTop: 4 }}>
            {props.seasonality.map((s) => (
              <span key={s} className="placeCardSeason">
                {seasonLabel(s)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="placeCardFullActions">
        {props.onMore && (
          <button type="button" className="primaryBtn secondaryBtnWide" onClick={props.onMore}>
            Подробнее
          </button>
        )}
        {props.onAtmosphere && (
          <button type="button" className="accentBtn secondaryBtnWide" onClick={props.onAtmosphere}>
            Окунуться в атмосферу места
          </button>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────
   Modal — full-screen overlay with panorama
   ──────────────────────────────────────────────────────── */

export function PlaceCardModal(
  props: PlaceCardProps & {
    open: boolean
    onClose: () => void
  },
) {
  const [panoramaError, setPanoramaError] = useState(false)
  const isNarrow = useMediaQuery('(max-width: 768px)')
  const panoHeight = isNarrow ? 280 : 380

  return (
    <AnimatePresence>
      {props.open && (
        <motion.div
          className="placeCardModalOverlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={props.onClose}
        >
          <motion.div
            className="placeCardModal"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="placeCardModalHeader">
              <div>
                <div className="placeCardModalTitle">{props.name}</div>
                <div className="placeCardModalAddr">{props.address ?? '—'}</div>
              </div>
              <button type="button" className="secondaryBtn" onClick={props.onClose}>
                Закрыть
              </button>
            </div>

            <div className="placeCardModalDesc">{props.description}</div>

            {(props.tourTags?.length || props.tags.length > 0) && (
              <div className="placeCardTags" style={{ marginTop: 10 }}>
                {props.tourTags?.map((t) => (
                  <span key={`tour-${t}`} className="placeCardTag placeCardTag--tour">
                    {t}
                  </span>
                ))}
                {props.tags.map((t) => (
                  <span key={t} className="placeCardTag placeCardTag--place">
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="placeCardModalGrid">
              <div className="placeCardModalInfoBlock">
                <div className="placeCardModalInfoTitle">Практическая информация</div>
                {props.phone && (
                  <div>
                    <b>Телефон: </b>
                    <a href={`tel:${props.phone}`}>{props.phone}</a>
                  </div>
                )}
                {props.website && (
                  <div style={{ marginTop: 4 }}>
                    <b>Сайт: </b>
                    <a href={props.website.startsWith('http') ? props.website : `https://${props.website}`} target="_blank" rel="noreferrer">
                      {props.website}
                    </a>
                  </div>
                )}
                {props.workingHours && (
                  <div style={{ marginTop: 4 }}>
                    <b>Часы работы: </b>
                    {props.workingHours}
                  </div>
                )}
                {props.prices && (
                  <div style={{ marginTop: 4 }}>
                    <b>Цены: </b>
                    {props.prices}
                  </div>
                )}
                {!props.phone && !props.workingHours && !props.prices && (
                  <div style={{ opacity: 0.7 }}>Информация уточняется</div>
                )}
              </div>

              <div className="placeCardModalInfoBlock">
                <div className="placeCardModalInfoTitle">Сезонность</div>
                {props.seasonality && props.seasonality.length > 0 ? (
                  <div className="placeCardSeasons">
                    {props.seasonality.map((s) => (
                      <span key={s} className="placeCardSeason">
                        {seasonLabel(s)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ opacity: 0.7 }}>Круглый год</div>
                )}
              </div>
            </div>

            <div className="placeCardModalPanorama">
              {!panoramaError ? (
                <YMaps query={YANDEX_MAPS_QUERY}>
                  <Panorama
                    defaultPoint={[props.lat, props.lng]}
                    width="100%"
                    height={panoHeight}
                    onError={() => setPanoramaError(true)}
                  />
                </YMaps>
              ) : (
                <div className="placeCardModalPanoFallback">
                  <div style={{ fontWeight: 850 }}>Панорама недоступна</div>
                  <div style={{ opacity: 0.8, marginTop: 6 }}>
                    Для этой точки 360° панорама не найдена.
                  </div>
                  {props.photos[0] && (
                    <img src={props.photos[0]} alt={`Фото: ${props.name}`} />
                  )}
                </div>
              )}
            </div>

            <a
              className="placeCardModalLink"
              href={`https://yandex.ru/maps/?pt=${props.lng},${props.lat}&z=14&l=map`}
              target="_blank"
              rel="noreferrer"
            >
              Открыть на Яндекс.Картах
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
