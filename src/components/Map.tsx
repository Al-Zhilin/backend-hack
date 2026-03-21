
import { geoService } from '../services/geoapify.ts';
import { useEffect, useMemo, useState, useRef } from 'react'
import { Clusterer, Map as YMap, Placemark, Polyline, TrafficControl, YMaps } from '@pbe/react-yandex-maps'
import { useNavigate } from 'react-router-dom'
import type { AuthProfile } from '../types'
import type { Location } from '../data/locations'
import { useRealLocations } from '../hooks/useRealLocations'
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
    const stay = interests.activityLevel === 'high' ? 'Гостевой дом / домик в природе' : 'Эко-гостевой дом'
    const food =
      from.vacationTypes.includes('gastro') || to.vacationTypes.includes('gastro') || from.placeTypes.includes('festivals')
        ? 'Локальная кухня + дегустации'
        : 'Питание по маршруту'

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

  // 1. ИНИЦИАЛИЗАЦИЯ ДАННЫХ (ВСЕ ХУКИ В НАЧАЛЕ)
  const { locations: realLocations, loading, error } = useRealLocations()
  
  const [selectedTags, setSelectedTags] = useState<TagChipId[]>([])
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [atmosphereOpen, setAtmosphereOpen] = useState(false)
  const routePlaceCount = props.initialRoutePlaceIds?.length ?? 5
  const [routePlaceIds, setRoutePlaceIds] = useState<string[]>(() => props.initialRoutePlaceIds ?? [])

  // 2. ЭФФЕКТЫ ДЛЯ ФОРМИРОВАНИЯ МАРШРУТА
  useEffect(() => {
    // Если еще грузимся или данных нет — ничего не делаем, но хук зарегистрирован!
    if (loading || !interests || realLocations.length === 0) return
    if (props.initialRoutePlaceIds?.length) return

    const candidates = filterLocationsByTagChips(realLocations, selectedTags)
    const nextInterests = buildInterestsFromTagChips(interests, selectedTags)
    const picked = pickRoutePlaceIds(candidates, nextInterests, routePlaceCount)
    if (picked.length) setRoutePlaceIds(picked)
  }, [realLocations, interests, props.initialRoutePlaceIds, selectedTags, routePlaceCount, loading])

  useEffect(() => {
    if (loading || !interests || realLocations.length === 0) return
    if (props.initialRoutePlaceIds?.length && selectedTags.length === 0) return

    const candidates = filterLocationsByTagChips(realLocations, selectedTags)
    const nextInterests = buildInterestsFromTagChips(interests, selectedTags)
    const picked = pickRoutePlaceIds(candidates, nextInterests, routePlaceCount)
    if (picked.length) setRoutePlaceIds(picked)
  }, [selectedTags, interests, routePlaceCount, realLocations, props.initialRoutePlaceIds?.length, loading])

  // 3. ВЫЧИСЛЯЕМЫЕ ЗНАЧЕНИЯ (MEMO)
  const availableChips = useMemo(() => {
    if (!interests) return []
    return getAvailableTagChips(interests)
  }, [interests])

  const visibleLocations = useMemo(() => {
    if (loading) return []
    return filterLocationsByTagChips(realLocations, selectedTags)
  }, [realLocations, selectedTags, loading])

  const mapCenter = useMemo(() => {
    if (!visibleLocations.length) return [44.7, 37.0] as [number, number]
    const avgLat = visibleLocations.reduce((s, l) => s + l.lat, 0) / visibleLocations.length
    const avgLng = visibleLocations.reduce((s, l) => s + l.lng, 0) / visibleLocations.length
    return [avgLat, avgLng] as [number, number]
  }, [visibleLocations])

  const routeLocations = useMemo(() => {
    if (loading) return []
    return routePlaceIds.map((id) => getById(id, realLocations)).filter(Boolean) as Location[]
  }, [routePlaceIds, realLocations, loading])

  const routeDays = Math.max(1, routePlaceIds.length - 1)
  
  const timeline = useMemo(() => {
    if (!interests || loading || realLocations.length === 0) return []
    return buildTimeline(routePlaceIds, realLocations, interests, routeDays)
  }, [routePlaceIds, interests, routeDays, realLocations, loading])

  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId || loading) return null
    return realLocations.find((l) => l.id === selectedPlaceId) ?? null
  }, [selectedPlaceId, realLocations, loading])

  const routeSet = useMemo(() => new Set(routePlaceIds), [routePlaceIds])
  
  const clusterLocations = useMemo(() => {
    return visibleLocations.filter((l) => !routeSet.has(l.id))
  }, [visibleLocations, routeSet])

  const onPlacemarkInstanceRef = (placeId: string) => {
    return (inst: any) => {
      if (!inst) return
      if (inst.__kubanClickAttached) return
      inst.__kubanClickAttached = true
      inst.events?.add?.('click', () => {
        setSelectedPlaceId(placeId)
      })
    }
  }

  // 4. УСЛОВНЫЕ ВОЗВРАТЫ ДЛЯ ЭКРАНОВ ЗАГРУЗКИ И ОШИБОК (ПОСЛЕ ВСЕХ ХУКОВ)
  if (loading) {
    return (
      <div className="mapShell">
        <div className="loadingContainer">
          <div className="spinner"></div>
          <h3>Загрузка реальных мест Краснодарского края...</h3>
          <p>Ищем достопримечательности, винодельни и природные объекты</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mapShell">
        <div className="errorContainer">
          <h3>⚠️ Ошибка загрузки мест</h3>
          <p>{error}</p>
          <button className="primaryBtn" onClick={() => window.location.reload()}>Повторить попытку</button>
        </div>
      </div>
    )
  }

  if (!realLocations.length && !loading) {
    return (
      <div className="mapShell">
        <div className="errorContainer">
          <h3>📍 Места не найдены</h3>
          <p>Не удалось найти места в Краснодарском крае. Попробуйте позже.</p>
        </div>
      </div>
    )
  }

  // 5. ОСНОВНОЙ РЕНДЕР
  return (
    <div className="mapShell">
      {!interests ? (
        <div className="page">
          <h2>Настройте интересы</h2>
          <p style={{ opacity: 0.85, marginTop: 10 }}>
            Чтобы карта фильтров работала и маршруты собирались — заполните опрос в профиле.
          </p>
        </div>
      ) : (
        <>
          <div className="mapOverlayLeft">
            <div className="card filtersCard">
              <div className="filtersTitle">
                Фильтры по тегам
                <span style={{ fontSize: 12, marginLeft: 8, color: '#666' }}>
                  ({visibleLocations.length} из {realLocations.length} мест)
                </span>
              </div>
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
                    >
                      {chip.label}
                    </div>
                  )
                })}
              </div>

              <div style={{ opacity: 0.75, marginTop: 10, fontWeight: 700 }}>
                🌍 Загружено из Geoapify: {realLocations.length}
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
          </div>

          <YMaps query={YANDEX_MAPS_QUERY} preload>
            <YMap
              defaultState={{ center: mapCenter, zoom: 9 }}
              width="100%"
              height="100%"
              options={{ suppressMapOpenBlock: true }}
            >
              <TrafficControl />

              {routeLocations.length >= 2 && <SmartRoute locations={routeLocations} />}

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

              {routeLocations.map((loc, idx) => (
                <Placemark
                  key={`${loc.id}_route_${idx}`}
                  geometry={[loc.lat, loc.lng]}
                  options={{ preset: 'islands#greenIcon' }}
                  properties={{
                    iconContent: `<div style="color:#ffffff;font-weight:900;">${idx + 1}</div>`,
                  }}
                  instanceRef={onPlacemarkInstanceRef(loc.id) as any}
                />
              ))}
            </YMap>
          </YMaps>

          <div className="timelineOverlay">
            <div className="card timelineCard">
              <div className="timelineTitle">Таймлайн маршрута</div>
              <div className="timelineItems">
                {timeline.map((t) => (
                  <div className="timelineItem" key={`${t.day}_${t.fromPlaceId}_${t.toPlaceId}`}>
                    <div className="timelineDay">День {t.day}</div>
                    <div className="timelineRoute">
                      {(realLocations.find((l) => l.id === t.fromPlaceId)?.name ?? t.fromPlaceId) + ' → '}
                      {realLocations.find((l) => l.id === t.toPlaceId)?.name ?? t.toPlaceId}
                    </div>
                    <div style={{ opacity: 0.8, marginTop: 8, fontSize: 13, lineHeight: 1.25 }}>
                      <div>🚗 {t.transport}</div>
                      <div>🏠 {t.stay}</div>
                      <div>🍽️ {t.food}</div>
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

function SmartRoute({ locations }: { locations: Location[] }) {
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);

  useEffect(() => {
    if (locations.length < 2) return;
  
    geoService.getRoute(locations.map(l => ({ lat: l.lat, lng: l.lng })))
      .then(data => {
        // Продвинутая обработка: склеиваем все части пути в один массив
        // Geoapify может вернуть несколько сегментов в зависимости от типа пути
        const features = data.features[0];
        let rawCoords = [];
        
        if (features.geometry.type === 'LineString') {
          rawCoords = features.geometry.coordinates;
        } else if (features.geometry.type === 'MultiLineString') {
          rawCoords = features.geometry.coordinates.flat();
        }
  
        const coords = rawCoords.map((c: number[]) => [c[1], c[0]] as [number, number]);
        setRouteGeometry(coords);
      })
      .catch(err => console.error("Маршрут не построился:", err));
  }, [locations]);

  if (routeGeometry.length === 0) return null;

  return (
    <Polyline
      geometry={routeGeometry}
      options={{
        strokeColor: '#16a34a',
        strokeWidth: 5,
        strokeOpacity: 0.8,
      }}
    />
  );
}