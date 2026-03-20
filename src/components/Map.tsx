import { useEffect, useMemo, useState } from 'react'
import { Clusterer, Map as YMap, Placemark, Polyline, TrafficControl, YMaps } from '@pbe/react-yandex-maps'
import { useNavigate } from 'react-router-dom'
import type { AuthProfile } from '../types'
import type { Location } from '../data/locations'
import { LOCATIONS } from '../data/locations'
import { pickRoutePlaceIds } from '../utils/scoring'
import { buildInterestsFromTagChips, filterLocationsByTagChips, getAvailableTagChips, type TagChipId } from '../utils/tagChips'

import PlaceSidePanelComponent from './PlaceSidePanel'
import AtmosphereModal from './AtmosphereModal'

import { YANDEX_MAPS_QUERY } from '../config/yandex'
import '../styles/map.scss'

type TimelineItem = {
  day: number
  fromPlaceId: string
  toPlaceId: string
  transport: string
  stay: string
  food: string
}

function getById(id: string, locations: Location[]) {
  return locations.find((l) => l.id === id) ?? null
}

function buildTimeline(placeIds: string[], locations: Location[], interests: NonNullable<AuthProfile['interests']>, days: number): TimelineItem[] {
  const timeline: TimelineItem[] = []
  for (let day = 0; day < days; day++) {
    const from = getById(placeIds[day], locations)
    const to = getById(placeIds[day + 1], locations)
    if (!from || !to) continue

    const transport =
      interests.activityLevel === 'high' || from.activity === 'high' || to.activity === 'high' ? 'Минивэн + тропа' : 'Комфортный трансфер'
    const stay = interests.activityLevel === 'high' ? 'Гостевой дом / домик в природе (заглушка)' : 'Эко-гостевой дом (заглушка)'
    const food =
      from.vacationTypes.includes('gastro') || to.vacationTypes.includes('gastro') || from.placeTypes.includes('festivals')
        ? 'Локальная кухня + дегустации (заглушка)'
        : 'Питание по маршруту (заглушка)'

    timeline.push({
      day: day + 1,
      fromPlaceId: from.id,
      toPlaceId: to.id,
      transport,
      stay,
      food,
    })
  }
  return timeline
}

export default function Map(props: { profile: AuthProfile; initialRoutePlaceIds?: string[] }) {
  const navigate = useNavigate()
  const interests = props.profile.interests

  // Чипы фильтров (multi-select)
  const [selectedTags, setSelectedTags] = useState<TagChipId[]>([])

  // Маркер/панель выбранного места
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)

  // Модалка “Окунуться…”
  const [atmosphereOpen, setAtmosphereOpen] = useState(false)

  // Длина маршрута (в точках = days + 1)
  const routePlaceCount = props.initialRoutePlaceIds?.length ?? 5

  const [routePlaceIds, setRoutePlaceIds] = useState<string[]>(() => props.initialRoutePlaceIds ?? [])

  // В момент первого монтирования (если маршрут не задан) сгенерируем его локально.
  useEffect(() => {
    if (!interests) return

    // Если маршрут пришёл из генератора — не перегенерируем без причины.
    if (props.initialRoutePlaceIds?.length) return

    const candidates = filterLocationsByTagChips(LOCATIONS, selectedTags)
    const nextInterests = buildInterestsFromTagChips(interests, selectedTags)
    const picked = pickRoutePlaceIds(candidates, nextInterests, routePlaceCount)
    if (picked.length) setRoutePlaceIds(picked)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // При смене фильтров пересобираем маршрут (только видимые точки).
  useEffect(() => {
    if (!interests) return

    // Если маршрут пришёл из генератора и пользователь ещё не выбрал фильтры,
    // сохраняем порядок точек как есть (иначе UX “прыгает”).
    if (props.initialRoutePlaceIds?.length && selectedTags.length === 0) return

    const candidates = filterLocationsByTagChips(LOCATIONS, selectedTags)
    const nextInterests = buildInterestsFromTagChips(interests, selectedTags)
    const picked = pickRoutePlaceIds(candidates, nextInterests, routePlaceCount)
    if (picked.length) setRoutePlaceIds(picked)
  }, [selectedTags, interests, routePlaceCount])

  const availableChips = useMemo(() => {
    if (!interests) return []
    return getAvailableTagChips(interests)
  }, [interests])

  const visibleLocations = useMemo(() => filterLocationsByTagChips(LOCATIONS, selectedTags), [selectedTags])

  const mapCenter = useMemo(() => {
    if (!visibleLocations.length) return [44.7, 37.0]
    const avgLat = visibleLocations.reduce((s, l) => s + l.lat, 0) / visibleLocations.length
    const avgLng = visibleLocations.reduce((s, l) => s + l.lng, 0) / visibleLocations.length
    return [avgLat, avgLng] as [number, number]
  }, [visibleLocations])

  const routeLocations = useMemo(() => {
    return routePlaceIds.map((id) => getById(id, LOCATIONS)).filter(Boolean) as Location[]
  }, [routePlaceIds])

  const routeDays = Math.max(1, routePlaceIds.length - 1)
  const timeline = useMemo(() => {
    if (!interests) return []
    return buildTimeline(routePlaceIds, LOCATIONS, interests, routeDays)
  }, [routePlaceIds, interests, routeDays])

  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) return null
    return LOCATIONS.find((l) => l.id === selectedPlaceId) ?? null
  }, [selectedPlaceId])

  const routeSet = useMemo(() => new Set(routePlaceIds), [routePlaceIds])
  const clusterLocations = useMemo(() => visibleLocations.filter((l) => !routeSet.has(l.id)), [visibleLocations, routeSet])

  // В yandex-maps wrapper нет “onClick” как у обычных компонентов — навешиваем обработчик через instanceRef.
  const onPlacemarkInstanceRef = (placeId: string) => {
    return (inst: any) => {
      if (!inst) return
      // Добавляем слушатель только один раз на инстанс.
      if (inst.__kubanClickAttached) return
      inst.__kubanClickAttached = true
      inst.events?.add?.('click', () => {
        setSelectedPlaceId(placeId)
      })
    }
  }

  return (
    <div className="mapShell">
      {!interests ? (
        <div className="page">
          <h2>Настройте интересы</h2>
          <p style={{ opacity: 0.85, marginTop: 10 }}>Чтобы карта фильтров работала и маршруты собирались — заполните опрос в профиле.</p>
        </div>
      ) : (
        <>
          <div className="mapOverlayLeft">
            <div className="card filtersCard">
              <div className="filtersTitle">Фильтры по тегам</div>
              <div className="chips" role="group" aria-label="Теги фильтра">
                {availableChips.map((chip) => {
                  const active = selectedTags.includes(chip.id)
                  return (
                    <div
                      key={chip.id}
                      className={`chip ${active ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedTags((prev) =>
                          prev.includes(chip.id) ? prev.filter((x) => x !== chip.id) : [...prev, chip.id].slice(0, 6),
                        )
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedTags((prev) => (prev.includes(chip.id) ? prev.filter((x) => x !== chip.id) : [...prev, chip.id]))
                        }
                      }}
                    >
                      {chip.label}
                    </div>
                  )
                })}
                {availableChips.length === 0 && <div style={{ opacity: 0.75 }}>Чипы пока не сформированы (нет интересов).</div>}
              </div>

              <div style={{ opacity: 0.75, marginTop: 10, fontWeight: 700 }}>
                Точек на карте: {visibleLocations.length}. Маршрут пересобирается при выборе фильтров.
              </div>

              {selectedTags.length > 0 && (
                <button
                  type="button"
                  className="secondaryBtn"
                  style={{ marginTop: 12, width: '100%' }}
                  onClick={() => setSelectedTags([])}
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          </div>

          <div className="mapOverlayRightTop">
            <button type="button" className="primaryBtn" onClick={() => navigate('/generate')}>
              Сгенерировать тур
            </button>
            <button
              type="button"
              className="secondaryBtn"
              onClick={() => {
                alert('MVP: Экспорт в PDF будет добавлен следующим шагом.');
              }}
            >
              Экспорт в PDF
            </button>
          </div>

          <YMaps query={YANDEX_MAPS_QUERY} preload>
            <YMap
              defaultState={{ center: mapCenter, zoom: 9 }}
              width="100%"
              height="100%"
              options={{ suppressMapOpenBlock: true }}
            >
              <TrafficControl />

              {routeLocations.length >= 2 && (
                <Polyline
                  geometry={routeLocations.map((l) => [l.lat, l.lng])}
                  options={{
                    strokeColor: 'rgba(22, 163, 74, 0.85)',
                    strokeWidth: 5,
                    strokeOpacity: 0.9,
                  }}
                />
              )}

              {/* Все “обычные” точки (кластеры), кроме точек маршрута */}
              {clusterLocations.length > 0 && (
                <Clusterer options={{ preset: 'islands#greenIcon', groupByCoordinates: false }}>
                  {clusterLocations.map((loc) => (
                    <Placemark
                      key={loc.id}
                      geometry={[loc.lat, loc.lng]}
                      options={{ preset: 'islands#greenIcon' }}
                      instanceRef={onPlacemarkInstanceRef(loc.id) as any}
                    />
                  ))}
                </Clusterer>
              )}

              {/* Точки маршрута: отдельные маркеры дней поверх кластера */}
              {routeLocations.map((loc, idx) => (
                <Placemark
                  key={`${loc.id}_route_${idx}`}
                  geometry={[loc.lat, loc.lng]}
                  options={{
                    preset: idx === 0 ? 'islands#greenIcon' : 'islands#greenIcon',
                  }}
                  properties={{
                    iconContent: `<div style="color:#ffffff;font-weight:900;">${idx + 1}</div>`,
                  }}
                  instanceRef={onPlacemarkInstanceRef(loc.id) as any}
                />
              ))}
            </YMap>
          </YMaps>

          {/* Таймлайн поверх карты */}
          <div className="timelineOverlay">
            <div className="card timelineCard">
              <div className="timelineTitle">Таймлайн маршрута</div>
              <div className="timelineItems">
                {timeline.map((t) => (
                  <div className="timelineItem" key={`${t.day}_${t.fromPlaceId}_${t.toPlaceId}`}>
                    <div className="timelineDay">День {t.day}</div>
                    <div className="timelineRoute">
                      {(LOCATIONS.find((l) => l.id === t.fromPlaceId)?.name ?? t.fromPlaceId) + ' → '}
                      {LOCATIONS.find((l) => l.id === t.toPlaceId)?.name ?? t.toPlaceId}
                    </div>
                    <div style={{ opacity: 0.8, marginTop: 8, fontSize: 13, lineHeight: 1.25 }}>
                      <div>Транспорт: {t.transport}</div>
                      <div>Жилье: {t.stay}</div>
                      <div>Питание: {t.food}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <PlaceSidePanelComponent
            open={Boolean(selectedPlace)}
            profile={props.profile}
            place={selectedPlace}
            onClose={() => setSelectedPlaceId(null)}
            onMore={() => {
              if (!selectedPlace) return
              navigate(`/place/${selectedPlace.id}`)
            }}
            onAtmosphere={() => setAtmosphereOpen(true)}
          />

          <AtmosphereModal open={atmosphereOpen} place={selectedPlace} onClose={() => setAtmosphereOpen(false)} />
        </>
      )}
    </div>
  )
}

