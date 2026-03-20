import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import type { GeneratedTrip } from '../types'
import { loadTrips } from '../utils/storage'
import { LOCATIONS } from '../data/locations'

function getLocName(id: string) {
  return LOCATIONS.find((l) => l.id === id)?.name ?? id
}

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleDateString('ru-RU')
  } catch {
    return String(ts)
  }
}

export default function TripsPage() {
  const navigate = useNavigate()

  const trips = useMemo(() => loadTrips(), [])

  return (
    <div className="page">
      <h2>Мои путешествия</h2>
      {trips.length === 0 ? (
        <div style={{ opacity: 0.8, marginTop: 10 }}>Пока нет сохранённых туров. Перейдите в “Сгенерировать тур”.</div>
      ) : (
        trips
          .slice()
          .reverse()
          .map((trip: GeneratedTrip) => (
            <div
              key={trip.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 16,
                padding: 14,
                marginTop: 12,
              background: 'rgba(255,255,255,0.85)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 900 }}>
                    Тур • {trip.days} дня • {trip.season}
                  </div>
                  <div style={{ opacity: 0.75, marginTop: 4 }}>{formatDate(trip.createdAt)}</div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {trip.routeVariants.map((v) => (
                    <React.Fragment key={v.id}>
                      <button
                        type="button"
                        className="primaryBtn"
                        onClick={() => navigate('/map', { state: { placeIds: v.placeIds } })}
                      >
                        Открыть на карте
                      </button>
                      <button
                        type="button"
                        className="secondaryBtn"
                        onClick={() => navigate(`/vr?placeId=${encodeURIComponent(v.keyPlaceIds[0])}`)}
                      >
                        VR/360
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 10, opacity: 0.9 }}>
                {trip.routeVariants[0]?.placeIds.slice(0, 4).map((id) => getLocName(id)).join(' → ')}
                {trip.routeVariants[0]?.placeIds.length > 4 ? ' …' : ''}
              </div>
            </div>
          ))
      )}
    </div>
  )
}

