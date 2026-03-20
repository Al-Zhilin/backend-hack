import { useMemo, useState } from 'react'
import type { AuthProfile, Interests } from '../types'
import { saveProfile } from '../utils/storage'

import InterestWizard from './InterestWizard'

function Chips(props: { items: string[] }) {
  if (!props.items.length) return <div style={{ opacity: 0.7 }}>—</div>
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      {props.items.map((t) => (
        <span
          key={t}
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          {t}
        </span>
      ))}
    </div>
  )
}

function normalizeLabels(interests: Interests) {
  // MVP: для читаемости выводим “как есть” id-ы; позже заменим маппинг на красивые названия.
  return {
    vacationTypes: interests.vacationTypes,
    placeTypes: interests.placeTypes.length ? interests.placeTypes : ['Пропустить'],
    companions: [interests.companions],
    season: [interests.season],
    activityLevel: [interests.activityLevel],
  }
}

export default function Profile(props: { profile: AuthProfile; onUpdate: (p: AuthProfile) => void }) {
  const { profile } = props
  const [editMode, setEditMode] = useState(false)

  const interests = profile.interests

  const labels = useMemo(() => (interests ? normalizeLabels(interests) : null), [interests])

  if (profile.role === 'partner') {
    return (
      <div className="page">
        <h2>Профиль партнёра</h2>
        <p style={{ opacity: 0.85 }}>Добавьте свою локацию позже — сейчас это MVP-заглушка.</p>
        <div className="primaryBtn" style={{ display: 'inline-block', marginTop: 12, opacity: 0.85 }}>
          Сохранено в профиле: {profile.email}
        </div>
      </div>
    )
  }

  if (!interests) {
    return (
      <div className="page">
        <h2>Профиль путешественника</h2>
        <p>Заполните опрос интересов, чтобы мы могли генерировать маршруты.</p>
        <button className="primaryBtn" type="button" onClick={() => setEditMode(true)}>
          Начать опрос
        </button>
      </div>
    )
  }

  if (!editMode) {
    return (
      <div className="page">
        <h2>
          {interests.displayName ? `Здравствуйте, ${interests.displayName}!` : 'Ваш профиль'}
        </h2>
        <p style={{ opacity: 0.85 }}>Интересы, которые используются для генерации туров:</p>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Формат отдыха</div>
          <Chips items={labels?.vacationTypes ?? []} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Типы мест</div>
          <Chips items={labels?.placeTypes ?? []} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>С кем едете</div>
          <Chips items={labels?.companions ?? []} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Сезон</div>
          <Chips items={labels?.season ?? []} />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Активность</div>
          <Chips items={labels?.activityLevel ?? []} />
        </div>

        <button className="primaryBtn" type="button" style={{ marginTop: 16 }} onClick={() => setEditMode(true)}>
          Редактировать опрос
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <h2>Редактирование опроса</h2>
      <InterestWizard
        initialInterests={interests}
        onComplete={(next) => {
          const updated: AuthProfile = { ...profile, interests: next }
          saveProfile(updated)
          props.onUpdate(updated)
          setEditMode(false)
        }}
      />
    </div>
  )
}

