import { PlaceCardCompact } from '../PlaceCard'
import type { Tour } from './types'

export default function TourCards(props: {
  tours: Tour[]
  selectedTourId: string | null
  onSelect: (tour: Tour) => void
}) {
  if (!props.tours.length) {
    return (
      <div className="tourCardsEmpty">
        <div className="tourCardsEmpty__icon" aria-hidden>
          🗺️
        </div>
        <p className="tourCardsEmpty__title">Пока нет вариантов</p>
        <p className="tourCardsEmpty__text">
          Опишите поездку в чате слева — здесь появятся 3–5 карточек туров с маршрутом на карте.
        </p>
      </div>
    )
  }

  return (
    <div className="tourCardsStrip">
      {props.tours.map((tour) => {
        const active = tour.id === props.selectedTourId
        return (
          <div key={tour.id} style={{ minWidth: 300, maxWidth: 380 }}>
            <PlaceCardCompact
              name={tour.title}
              description={tour.description}
              photos={tour.points[0]?.photoUrl ? [tour.points[0].photoUrl] : []}
              tags={tour.points.flatMap((p) => p.tags).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4)}
              tourTags={tour.tags?.slice(0, 3)}
              prices={tour.price}
              seasonality={tour.seasonality}
              workingHours={undefined}
              address={`${tour.duration} дн. • ${tour.points.length} мест`}
              lat={tour.points[0]?.lat ?? 0}
              lng={tour.points[0]?.lng ?? 0}
              active={active}
              onAction={() => props.onSelect(tour)}
              actionLabel="Посмотреть маршрут"
            />
          </div>
        )
      })}
    </div>
  )
}
