import type { Tour } from './types'

export default function TourCards(props: {
  tours: Tour[]
  selectedTourId: string | null
  onSelect: (tour: Tour) => void
}) {
  if (!props.tours.length) {
    return <div style={{ opacity: 0.7 }}>После генерации здесь появятся карточки туров (3-5 вариантов).</div>
  }

  return (
    <div style={{ display: 'flex', gap: 10, overflow: 'auto', paddingBottom: 4 }}>
      {props.tours.map((tour) => {
        const active = tour.id === props.selectedTourId
        return (
          <article
            key={tour.id}
            className="card"
            style={{
              minWidth: 280,
              maxWidth: 360,
              padding: 12,
              border: active ? '1px solid rgba(22,163,74,0.65)' : undefined,
              background: active ? 'rgba(22,163,74,0.09)' : undefined,
            }}
          >
            <div style={{ fontWeight: 900 }}>{tour.title}</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              {tour.duration} дн. • {tour.price}
            </div>
            <div style={{ marginTop: 8, lineHeight: 1.3, opacity: 0.88 }}>{tour.description}</div>
            <button type="button" className="primaryBtn" style={{ marginTop: 10 }} onClick={() => props.onSelect(tour)}>
              Посмотреть маршрут
            </button>
          </article>
        )
      })}
    </div>
  )
}

