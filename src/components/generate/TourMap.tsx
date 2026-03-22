import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as YMap, Placemark, Polyline, YMaps } from '@pbe/react-yandex-maps'

import type { Tour, TourPoint } from './types'
import { YANDEX_MAPS_QUERY } from '../../config/yandex'
import { attachPlacemarkSelect } from '../../utils/placemarkTouch'
import '../../styles/tour-map.scss'
import Preloader from '../Preloader'

const ROUTE_COLOR = '#16a34a'

export default function TourMap(props: {
  tour: Tour | null
  routeMode: 'auto' | 'pedestrian' | 'bicycle'
  onPickPoint: (p: TourPoint) => void
}) {
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([])
  const [routeLoading, setRouteLoading] = useState(false)
  const prevKeyRef = useRef('')

  const points = props.tour?.points ?? []

  const center = useMemo<[number, number]>(() => {
    if (!points.length) return [44.8, 38.5]
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length
    return [avgLat, avgLng]
  }, [points])

  const zoom = useMemo(() => {
    if (!points.length) return 9
    if (points.length === 1) return 14
    const lats = points.map(p => p.lat)
    const lngs = points.map(p => p.lng)
    const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs))
    if (span > 2) return 8
    if (span > 1) return 9
    if (span > 0.5) return 10
    if (span > 0.2) return 11
    if (span > 0.05) return 13
    return 14
  }, [points])

  const routeKey = useMemo(
    () => `${props.routeMode}::${points.map(p => `${p.lat}_${p.lng}`).join('|')}`,
    [points, props.routeMode],
  )

  useEffect(() => {
    if (points.length < 2) {
      setRouteGeometry([])
      setRouteLoading(false)
      return
    }

    if (prevKeyRef.current === routeKey) return
    prevKeyRef.current = routeKey

    let cancelled = false
    setRouteLoading(true)

    const mode = props.routeMode === 'pedestrian' ? 'walk' : props.routeMode === 'bicycle' ? 'bicycle' : 'drive'
    const waypoints = points.map(p => `${p.lat},${p.lng}`).join('|')
    const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY as string
    const baseUrl = import.meta.env.VITE_GEOAPIFY_BASE_URL_V1 as string

    fetch(`${baseUrl}/routing?waypoints=${waypoints}&mode=${mode}&apiKey=${apiKey}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const feature = data.features?.[0]
        if (!feature?.geometry) {
          setRouteGeometry([])
          return
        }

        let rawCoords: number[][] = []
        if (feature.geometry.type === 'LineString') {
          rawCoords = feature.geometry.coordinates
        } else if (feature.geometry.type === 'MultiLineString') {
          rawCoords = feature.geometry.coordinates.flat()
        }

        setRouteGeometry(rawCoords.map((c: number[]) => [c[1], c[0]] as [number, number]))
      })
      .catch(() => {
        if (!cancelled) setRouteGeometry([])
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false)
      })

    return () => { cancelled = true }
  }, [routeKey, props.routeMode, points])

  return (
    <div className="tourMapWrap tourMapWrap--relative">
      <YMaps query={YANDEX_MAPS_QUERY} preload>
        <YMap
          defaultState={{ center, zoom }}
          state={{ center, zoom }}
          width="100%"
          height="100%"
          options={{ suppressMapOpenBlock: true }}
        >
          {routeGeometry.length >= 2 && (
            <Polyline
              geometry={routeGeometry}
              options={{
                strokeColor: ROUTE_COLOR,
                strokeWidth: 5,
                strokeOpacity: 0.85,
              }}
            />
          )}

          {points.map((p, i) => (
            <Placemark
              key={p.id}
              geometry={[p.lat, p.lng]}
              options={{
                preset: i === 0
                  ? 'islands#greenStretchyIcon'
                  : i === points.length - 1
                    ? 'islands#redStretchyIcon'
                    : 'islands#blueStretchyIcon',
                zIndex: 100 + i,
              }}
              properties={{
                iconContent: `${i + 1}`,
                balloonContentHeader: `${i + 1}. ${p.name}`,
                balloonContentBody: [p.address, p.tags.length ? p.tags.join(', ') : ''].filter(Boolean).join('<br/>'),
                balloonContentFooter: p.description || undefined,
              }}
              instanceRef={(inst: any) => {
                if (!inst) return
                attachPlacemarkSelect(inst, () => props.onPickPoint(p))
              }}
            />
          ))}
        </YMap>
      </YMaps>
      {routeLoading && (
        <div className="tourMapPreloader">
          <Preloader variant="overlay" label="Построение маршрута…" sublabel="Расчёт пути по дорогам" />
        </div>
      )}
    </div>
  )
}
