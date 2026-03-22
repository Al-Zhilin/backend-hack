import { useMemo, useState } from 'react'
import type { AuthProfile, Interests } from '../types'
import { saveProfile } from '../utils/storage'
import InterestWizard from './InterestWizard'

// Вспомогательный компонент для тегов
function Chips({ items, onDelete }: { items: string[]; onDelete?: (item: string) => void }) {
  if (!items || !items.length) return <div style={{ opacity: 0.5, fontSize: '0.9em' }}>Не указано</div>
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      {items.map((t) => (
        <span
          key={t}
          style={{
            padding: '6px 12px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            fontSize: '0.85em',
            color: '#efefef',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {t}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(t)}
              style={{ background: 'none', border: 'none', color: '#efefef', cursor: 'pointer', padding: 0, fontSize: '0.9em' }}
            >
              &times;
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

function normalizeLabels(interests: Interests) {
  return {
    vacationTypes: interests.vacationTypes || [],
    placeTypes: interests.placeTypes?.length ? interests.placeTypes : ['Любые'],
    companions: [interests.companions].filter(Boolean),
    season: [interests.season].filter(Boolean),
    activityLevel: [interests.activityLevel].filter(Boolean),
  }
}

export default function Profile(props: { profile: AuthProfile; onUpdate: (p: AuthProfile) => void }) {
  const { profile } = props
  const [editMode, setEditMode] = useState(false)

  const interests = profile.interests

  // Функция для удаления конкретного тега
  const handleRemoveInterest = (category: keyof Interests, value: string) => {
    if (!interests) return

    const currentVal = interests[category]
    let nextVal: any

    if (Array.isArray(currentVal)) {
      // Для массивов (vacationTypes, placeTypes) фильтруем
      nextVal = currentVal.filter((item) => item !== value)
    } else {
      // Для одиночных значений (season, activityLevel) сбрасываем в пустую строку или дефолт
      nextVal = ''
    }

    const updated: AuthProfile = {
      ...profile,
      interests: { ...interests, [category]: nextVal },
    }

    saveProfile(updated)
    props.onUpdate(updated)
  }

  const _labels = useMemo(() => (interests ? normalizeLabels(interests) : null), [interests])
  void _labels

  // Рендер для партнера остается без изменений
  if (profile.role === 'partner') { /* ... ваш код ... */ }

  if (!interests || editMode) {
    return (
      <div className="page">
        <h2>{editMode ? 'Редактирование интересов' : 'Профиль путешественника'}</h2>
        <InterestWizard
          initialInterests={interests || {} as Interests}
          onComplete={(next) => {
            const updated: AuthProfile = { ...profile, interests: next }
            saveProfile(updated)
            props.onUpdate(updated)
            setEditMode(false)
          }}
        />
        {editMode && (
           <button 
            className="secondaryBtn" 
            style={{ marginTop: 10 }} 
            onClick={() => setEditMode(false)}
           >
            Отмена
           </button>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <h2>{interests.displayName ? `Здравствуйте, ${interests.displayName}!` : 'Ваш профиль'}</h2>
      
      {/* Пример секции с возможностью удаления */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 800 }}>Формат отдыха</div>
        <Chips 
          items={interests.vacationTypes} 
          onDelete={(item) => handleRemoveInterest('vacationTypes', item)} 
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 800 }}>Типы мест</div>
        <Chips 
          items={interests.placeTypes} 
          onDelete={(item) => handleRemoveInterest('placeTypes', item)} 
        />
      </div>

      {/* Для одиночных тегов тоже можно оставить крестик, чтобы "сбросить" выбор */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 800 }}>Сезон</div>
        <Chips 
          items={interests.season ? [interests.season] : []} 
          onDelete={() => handleRemoveInterest('season', interests.season)} 
        />
      </div>

      <button className="primaryBtn" style={{ marginTop: 24 }} onClick={() => setEditMode(true)}>
        Изменить всё
      </button>
    </div>
  )
}