import type { UserRole } from '../types'

export default function RoleChoice(props: { onChoose: (role: UserRole) => void }) {
  return (
    <div className="roleChoice">
      <h2 className="sectionTitle">Кто вы в этом туре?</h2>
      <div className="roleGrid">
        <button
          type="button"
          className="roleCard"
          onClick={() => props.onChoose('traveler')}
        >
          <div className="roleTitle">Я путешественник</div>
          <div className="roleDesc">Подберём маршрут по интересам и сезону.</div>
        </button>
        <button
          type="button"
          className="roleCard"
          onClick={() => props.onChoose('partner')}
        >
          <div className="roleTitle">Я партнёр</div>
          <div className="roleDesc">Добавьте локацию — туристы найдут вас.</div>
        </button>
      </div>
    </div>
  )
}

