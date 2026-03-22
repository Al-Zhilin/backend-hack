import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as YMap, Placemark, TrafficControl, YMaps } from '@pbe/react-yandex-maps'

import type { Tour, TourPoint } from './types'
import { YANDEX_MAPS_QUERY } from '../../config/yandex'
import { attachPlacemarkSelect } from '../../utils/placemarkTouch'
import '../../styles/tour-map.scss'
import Preloader from '../Preloader'

export default function TourMap(props: {
  tour: Tour | null
  routeMode: 'auto' | 'pedestrian'
  onPickPoint: (p: TourPoint) => void
}) {
  const mapRef = useRef<any>(null)
  const routeRef = useRef<any>(null)
  const [routeBuilding, setRouteBuilding] = useState(false)

  const center = useMemo<[number, number]>(() => {
    if (!props.tour?.points.length) return [44.8, 38.5]
    const avgLat = props.tour.points.reduce((s, p) => s + p.lat, 0) / props.tour.points.length
    const avgLng = props.tour.points.reduce((s, p) => s + p.lng, 0) / props.tour.points.length
    return [avgLat, avgLng]
  }, [props.tour])

  useEffect(() => {
    if (!mapRef.current || !props.tour || props.tour.points.length < 2) {
      setRouteBuilding(false)
      return
    }
    const ymapsApi = mapRef.current?.constructor?.ymaps ?? (window as any).ymaps
    if (!ymapsApi?.multiRouter?.MultiRoute) {
      setRouteBuilding(false)
      return
    }

    setRouteBuilding(true)

    if (routeRef.current) {
      mapRef.current.geoObjects.remove(routeRef.current)
      routeRef.current = null
    }

    const waypoints = props.tour.points.map((p) => [p.lat, p.lng])

    const route = new ymapsApi.multiRouter.MultiRoute(
      {
        referencePoints: waypoints,
        params: {
          routingMode: props.routeMode,
          avoidTrafficJams: false,
        },
      },
      {
        boundsAutoApply: true,
      },
    )

    mapRef.current.geoObjects.add(route)
    routeRef.current = route

    const done = setTimeout(() => setRouteBuilding(false), 1200)
    return () => clearTimeout(done)
  }, [props.tour, props.routeMode])

  return (
    <div className="tourMapWrap tourMapWrap--relative">
      <YMaps query={YANDEX_MAPS_QUERY} preload>
        <YMap
          defaultState={{ center, zoom: 9 }}
          state={{ center, zoom: 9 }}
          width="100%"
          height="100%"
          options={{ suppressMapOpenBlock: true }}
          instanceRef={(inst: any) => {
            mapRef.current = inst
          }}
        >
          <TrafficControl />

          {props.tour?.points.map((p) => (
            <Placemark
              key={p.id}
              geometry={[p.lat, p.lng]}
              options={{ preset: 'islands#greenDotIcon' }}
              properties={{
                balloonContentHeader: p.name,
                balloonContentBody: `${p.address}<br/>${p.tags.join(', ')}`,
                balloonContentFooter: p.description,
              }}
              instanceRef={(inst: any) => {
                if (!inst) return
                attachPlacemarkSelect(inst, () => props.onPickPoint(p))
              }}
            />
          ))}
        </YMap>
      </YMaps>
      {routeBuilding && (
        <div className="tourMapPreloader">
          <Preloader variant="overlay" label="Построение маршрута Яндекс.Карт…" sublabel="Подождите, пока пересчитается дорога" />
        </div>
      )}
    </div>
  )
}

