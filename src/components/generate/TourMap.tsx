import { useEffect, useMemo, useRef } from 'react'
import { Map as YMap, Placemark, TrafficControl, YMaps } from '@pbe/react-yandex-maps'

import type { Tour, TourPoint } from './types'
import { YANDEX_MAPS_QUERY } from '../../config/yandex'

export default function TourMap(props: {
  tour: Tour | null
  routeMode: 'auto' | 'pedestrian'
  onPickPoint: (p: TourPoint) => void
}) {
  const mapRef = useRef<any>(null)
  const routeRef = useRef<any>(null)

  const center = useMemo<[number, number]>(() => {
    if (!props.tour?.points.length) return [44.8, 38.5]
    const avgLat = props.tour.points.reduce((s, p) => s + p.lat, 0) / props.tour.points.length
    const avgLng = props.tour.points.reduce((s, p) => s + p.lng, 0) / props.tour.points.length
    return [avgLat, avgLng]
  }, [props.tour])

  useEffect(() => {
    if (!mapRef.current || !props.tour || props.tour.points.length < 2) return
    const ymapsApi = mapRef.current?.constructor?.ymaps ?? (window as any).ymaps
    if (!ymapsApi?.multiRouter?.MultiRoute) return

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
  }, [props.tour, props.routeMode])

  return (
    <div style={{ height: 520, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
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
                if (!inst || inst.__pointClickBound) return
                inst.__pointClickBound = true
                inst.events?.add?.('click', () => props.onPickPoint(p))
              }}
            />
          ))}
        </YMap>
      </YMaps>
    </div>
  )
}

