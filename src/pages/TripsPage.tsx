import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import type { GeneratedTrip } from '../types'
import { loadTrips, saveTrips } from '../utils/storage'
import { LOCATIONS } from '../data/locations'

function getLocName(id: string, trip: GeneratedTrip) {
  const tp = trip.tourPoints?.find(p => p.id === id)
  if (tp) return tp.name
  return LOCATIONS.find((l) => l.id === id)?.name ?? id
}

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return String(ts)
  }
}

function formatDuration(minutes: number): string {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} мин`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} ч ${m} мин` : `${h} ч`
}

export default function TripsPage() {
  const navigate = useNavigate()
  const trips = useMemo(() => loadTrips(), [])

  const handleDelete = (tripId: string) => {
    const updated = trips.filter(t => t.id !== tripId)
    saveTrips(updated)
    window.location.reload()
  }

  const handleOpenOnMap = (trip: GeneratedTrip) => {
    if (trip.tourPoints?.length) {
      const tourPoints = trip.tourPoints.map(tp => ({
        id: tp.id, name: tp.name, address: tp.address,
        lat: tp.lat, lng: tp.lng, description: '', tags: tp.tags,
      }))
      navigate('/map', { state: { tourPoints } })
    } else {
      navigate('/map', { state: { placeIds: trip.routeVariants[0]?.placeIds } })
    }
  }

  return (
    <div className="page">
      <h2>Мои путешествия</h2>
      {trips.length === 0 ? (
        <div style={{ opacity: 0.8, marginTop: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
          <p>Пока нет сохранённых туров.</p>
          <button
            type="button"
            className="primaryBtn"
            style={{ marginTop: 12 }}
            onClick={() => navigate('/generate')}
          >
            Сгенерировать тур
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          {trips
            .slice()
            .reverse()
            .map((trip: GeneratedTrip) => {
              const pointNames = trip.tourPoints?.length
                ? trip.tourPoints.map(p => p.name)
                : trip.routeVariants[0]?.placeIds.map(id => getLocName(id, trip)) ?? []

              return (
                <div
                  key={trip.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    padding: 16,
                    background: 'rgba(255,255,255,0.9)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>
                        {trip.transportMode ?? 'Тур'} • {trip.tourPoints?.length ?? trip.routeVariants[0]?.placeIds.length ?? 0} мест
                      </div>
                      <div style={{ opacity: 0.6, marginTop: 4, fontSize: 13 }}>{formatDate(trip.createdAt)}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="primaryBtn" onClick={() => handleOpenOnMap(trip)}>
                        Открыть на карте
                      </button>
                      <button
                        type="button"
                        className="secondaryBtn"
                        onClick={() => handleDelete(trip.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5 }}>
                    {pointNames.slice(0, 5).join(' → ')}
                    {pointNames.length > 5 ? ' …' : ''}
                  </div>

                  <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', fontSize: 13, opacity: 0.75 }}>
                    {trip.totalKm != null && <span>📏 {trip.totalKm} км</span>}
                    {trip.totalMinutes != null && <span>⏱️ ~{formatDuration(trip.totalMinutes)}</span>}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
