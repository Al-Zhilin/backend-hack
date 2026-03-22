
import { geoService } from '../services/geoapify.ts';
import { useEffect, useMemo, useState, useRef, useCallback  } from 'react'
import { Clusterer, Map as YMap, Placemark, Polyline, TrafficControl, YMaps } from '@pbe/react-yandex-maps'
import { useNavigate } from 'react-router-dom'
import type { AuthProfile } from '../types'
import type { Location } from '../data/locations'
import type { TourPoint } from './generate/types'
import { useRealLocations } from '../hooks/useRealLocations'
import { pickRoutePlaceIds } from '../utils/scoring'
import { buildInterestsFromTagChips, filterLocationsByTagChips, getAvailableTagChips, type TagChipId } from '../utils/tagChips'

import PlaceSidePanelComponent from './PlaceSidePanel'
import AtmosphereModal from './AtmosphereModal'

import { YANDEX_MAPS_QUERY } from '../config/yandex'
import { attachPlacemarkSelect } from '../utils/placemarkTouch'
import { getPlacemarkOptionsForLocation, getRoutePlacemarkOptions, MAP_LEGEND_ITEMS } from '../utils/mapMarkers'
import Preloader from './Preloader'
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

function tourPointToLocation(tp: TourPoint): Location {
  return {
    id: tp.id,
    name: tp.name,
    lat: tp.lat,
    lng: tp.lng,
    description: tp.description || '',
    address: tp.address || '',
    photoUrl: tp.photoUrl || '',
    placeTypes: [],
    vacationTypes: [],
    seasons: [],
    activity: 'medium',
    suitableFor: [],
  }
}

export default function Map(props: { profile: AuthProfile; initialRoutePlaceIds?: string[]; initialTourPoints?: TourPoint[] }) {
  const navigate = useNavigate()
  const interests = props.profile.interests

  // 1. ИНИЦИАЛИЗАЦИЯ ДАННЫХ (ВСЕ ХУКИ В НАЧАЛЕ)
  const { locations: realLocations, loading, error } = useRealLocations();
  const [, setAllPlaces] = useState<Location[]>([]);
  
  const [selectedTags, setSelectedTags] = useState<TagChipId[]>([])
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
  const [atmosphereOpen, setAtmosphereOpen] = useState(false)
  const [boundsLoading, setBoundsLoading] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeMode, setRouteMode] = useState<'drive' | 'walk' | 'bicycle'>('drive')
  const externalRouteLocations = useMemo(() => {
    if (!props.initialTourPoints?.length) return null
    return props.initialTourPoints.map(tourPointToLocation)
  }, [props.initialTourPoints])

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

  const _mapCenter = useMemo(() => {
    if (!visibleLocations.length) return [44.7, 37.0] as [number, number]
    const avgLat = visibleLocations.reduce((s, l) => s + l.lat, 0) / visibleLocations.length
    const avgLng = visibleLocations.reduce((s, l) => s + l.lng, 0) / visibleLocations.length
    return [avgLat, avgLng] as [number, number]
  }, [visibleLocations])
  void _mapCenter

  const routeLocations = useMemo(() => {
    if (externalRouteLocations) return externalRouteLocations
    if (loading) return []
    return routePlaceIds.map((id) => getById(id, realLocations)).filter(Boolean) as Location[]
  }, [routePlaceIds, realLocations, loading, externalRouteLocations])

  const routeDays = Math.max(1, routeLocations.length - 1)
  
  const timeline = useMemo(() => {
    if (externalRouteLocations) {
      return externalRouteLocations.slice(0, -1).map((loc, i) => ({
        day: i + 1,
        fromPlaceId: loc.id,
        toPlaceId: externalRouteLocations[i + 1].id,
        transport: '🚶 Пешком',
        stay: '',
        food: '',
      }))
    }
    if (!interests || loading || realLocations.length === 0) return []
    return buildTimeline(routePlaceIds, realLocations, interests, routeDays)
  }, [routePlaceIds, interests, routeDays, realLocations, loading, externalRouteLocations])

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
      attachPlacemarkSelect(inst, () => setSelectedPlaceId(placeId))
    }
  }
  const debouncedBoundsChange = useRef<any>();
  const handleBoundsChange = useCallback((event: any) => {
    if (debouncedBoundsChange.current) {
      clearTimeout(debouncedBoundsChange.current);
    }
    
    debouncedBoundsChange.current = setTimeout(async () => {
      const map = event.get('target');
      const bounds = map.getBounds();
      const filterRect = `${bounds[0][1]},${bounds[0][0]},${bounds[1][1]},${bounds[1][0]}`;

      setBoundsLoading(true);
      try {
        const newPlaces = await geoService.getPlacesByBounds(filterRect);
        setAllPlaces((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNew = newPlaces.filter((p: any) => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
      } catch (e) {
        console.error('Ошибка подгрузки точек:', e);
      } finally {
        setBoundsLoading(false);
      }
    }, 500); // Задержка 500ms
  }, []);

  // 4. УСЛОВНЫЕ ВОЗВРАТЫ ДЛЯ ЭКРАНОВ ЗАГРУЗКИ И ОШИБОК (ПОСЛЕ ВСЕХ ХУКОВ)
  if (loading) {
    return (
      <div className="mapShell mapShell--centeredLoading">
        <Preloader
          variant="full"
          label="Загрузка реальных мест Краснодарского края…"
          sublabel="Запрос к Geoapify: винодельни, парки, кафе и другие точки в границах края"
        />
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

            <div className="mapLegend card" aria-label="Типы меток на карте">
              <div className="mapLegendTitle">Типы мест</div>
              <div className="mapLegendGrid">
                {MAP_LEGEND_ITEMS.map((item) => (
                  <div key={item.type} className="mapLegendRow">
                    <span className="mapLegendDot" style={{ backgroundColor: item.color }} aria-hidden />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mapOverlayRightTop">
            <div className="mapRouteMode">
              {([
                { value: 'drive', label: 'Авто', icon: '🚗' },
                { value: 'walk', label: 'Пешком', icon: '🚶' },
                { value: 'bicycle', label: 'Велосипед', icon: '🚲' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`mapRouteMode__btn ${routeMode === opt.value ? 'mapRouteMode__btn--active' : ''}`}
                  onClick={() => setRouteMode(opt.value)}
                  title={opt.label}
                >
                  <span className="mapRouteMode__icon">{opt.icon}</span>
                  <span className="mapRouteMode__label">{opt.label}</span>
                </button>
              ))}
            </div>
            <button type="button" className="primaryBtn" onClick={() => navigate('/generate')}>
              Сгенерировать тур
            </button>
          </div>

          <div className="mapMapWrap">
            <YMaps query={YANDEX_MAPS_QUERY} preload>
              <YMap
                onBoundsChange={handleBoundsChange}
                defaultState={{
                  center: externalRouteLocations?.length
                    ? [
                        externalRouteLocations.reduce((s, l) => s + l.lat, 0) / externalRouteLocations.length,
                        externalRouteLocations.reduce((s, l) => s + l.lng, 0) / externalRouteLocations.length,
                      ]
                    : [45.035, 38.975],
                  zoom: externalRouteLocations?.length ? 12 : 8,
                }}
                width="100%"
                height="100%"
                options={{ suppressMapOpenBlock: true }}
              >
                <TrafficControl />

                {routeLocations.length >= 2 && (
                  <SmartRoute locations={routeLocations} mode={routeMode} onLoadingChange={setRouteLoading} />
                )}

              {clusterLocations.length > 0 && (
                <Clusterer options={{ preset: 'islands#circleDotIcon', groupByCoordinates: false }}>
                  {clusterLocations.map((loc) => {
                    const pm = getPlacemarkOptionsForLocation(loc)
                    return (
                      <Placemark
                        key={loc.id}
                        geometry={[loc.lat, loc.lng]}
                        options={pm.options as any}
                        properties={pm.properties as any}
                        instanceRef={onPlacemarkInstanceRef(loc.id) as any}
                      />
                    )
                  })}
                </Clusterer>
              )}

              {routeLocations.map((loc, idx) => {
                const pm = getRoutePlacemarkOptions(loc, idx)
                return (
                  <Placemark
                    key={`${loc.id}_route_${idx}`}
                    geometry={[loc.lat, loc.lng]}
                    options={pm.options as any}
                    properties={pm.properties as any}
                    instanceRef={onPlacemarkInstanceRef(loc.id) as any}
                  />
                )
              })}
              </YMap>
            </YMaps>

            {boundsLoading && (
              <Preloader variant="corner" label="Подгрузка мест в видимой области…" />
            )}
            {routeLoading && !boundsLoading && (
              <Preloader variant="corner" label="Построение маршрута…" />
            )}
          </div>

          <div className="timelineOverlay">
            <div className="card timelineCard">
              <div className="timelineTitle">Таймлайн маршрута</div>
              <div className="timelineItems">
                {timeline.map((t) => (
                  <div className="timelineItem" key={`${t.day}_${t.fromPlaceId}_${t.toPlaceId}`}>
                    <div className="timelineDay">День {t.day}</div>
                    <div className="timelineRoute">
                      {(routeLocations.find((l) => l.id === t.fromPlaceId)?.name
                        ?? realLocations.find((l) => l.id === t.fromPlaceId)?.name
                        ?? t.fromPlaceId) + ' → '}
                      {routeLocations.find((l) => l.id === t.toPlaceId)?.name
                        ?? realLocations.find((l) => l.id === t.toPlaceId)?.name
                        ?? t.toPlaceId}
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

function SmartRoute({
  locations,
  mode = 'drive',
  onLoadingChange,
}: {
  locations: Location[]
  mode?: 'drive' | 'walk' | 'bicycle'
  onLoadingChange?: (loading: boolean) => void
}) {
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([])

  useEffect(() => {
    if (locations.length < 2) {
      onLoadingChange?.(false)
      setRouteGeometry([])
      return
    }

    let cancelled = false
    onLoadingChange?.(true)

    geoService
      .getRoute(locations.map((l) => ({ lat: l.lat, lng: l.lng })), mode)
      .then((data) => {
        if (cancelled) return
        const features = data.features?.[0]
        if (!features?.geometry) {
          setRouteGeometry([])
          return
        }
        let rawCoords: number[][] = []

        if (features.geometry.type === 'LineString') {
          rawCoords = features.geometry.coordinates
        } else if (features.geometry.type === 'MultiLineString') {
          rawCoords = features.geometry.coordinates.flat()
        }

        const coords = rawCoords.map((c: number[]) => [c[1], c[0]] as [number, number])
        setRouteGeometry(coords)
      })
      .catch((err) => {
        console.error('Маршрут не построился:', err)
        if (!cancelled) setRouteGeometry([])
      })
      .finally(() => {
        if (!cancelled) onLoadingChange?.(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, mode])

  if (routeGeometry.length === 0) return null

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