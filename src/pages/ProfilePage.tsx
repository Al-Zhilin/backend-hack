import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { AuthProfile } from '../types'
import { loadTrips, saveProfile, clearProfile } from '../utils/storage'

import InterestWizard from '../components/InterestWizard'
import type { UserTagId } from '../utils/userTagMapping'
import { buildInterestsFromUserTagIds, deriveUserTagIdsFromInterests, USER_TAGS } from '../utils/userTagMapping'

import '../styles/profile.scss'

type BudgetId = 'economy' | 'comfort' | 'premium'

type ProfileSettings = {
  notifications: {
    newTours: boolean
    deals: boolean
    weather: boolean
  }
  budget: BudgetId
  language: 'ru' | 'en'
  theme: 'light' | 'dark'
}

const SETTINGS_KEY = 'kubanSmotry.profile.settings.v1'

function loadSettings(): ProfileSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      return {
        notifications: { newTours: true, deals: false, weather: true },
        budget: 'comfort',
        language: 'ru',
        theme: 'light',
      }
    }
    const parsed = JSON.parse(raw) as ProfileSettings
    return parsed
  } catch {
    return {
      notifications: { newTours: true, deals: false, weather: true },
      budget: 'comfort',
      language: 'ru',
      theme: 'light',
    }
  }
}

function saveSettings(next: ProfileSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
}

function formatISODate(ts: number) {
  try {
    return new Date(ts).toLocaleDateString('ru-RU')
  } catch {
    return String(ts)
  }
}

function buildMockStats() {
  return {
    savedTrips: 7,
    visitedPlaces: 14,
    days: 28,
    regions: 9,
  }
}

export default function ProfilePage(props: { profile: AuthProfile; onUpdate: (p: AuthProfile) => void }) {
  const navigate = useNavigate()
  const { profile } = props

  const [editMode, setEditMode] = useState(true)
  const [settings, setSettings] = useState<ProfileSettings>(() => loadSettings())

  const [selectedTags, setSelectedTags] = useState<UserTagId[]>(() => (profile.interests ? deriveUserTagIdsFromInterests(profile.interests) : []))

  useEffect(() => {
    setSelectedTags(profile.interests ? deriveUserTagIdsFromInterests(profile.interests) : [])
  }, [profile.interests])

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // Тема: MVP — визуально влияет только на `color-scheme` (полное dark-styling в рамках этой задачи не делали).
  useEffect(() => {
    document.documentElement.style.colorScheme = settings.theme === 'dark' ? 'dark' : 'light'
  }, [settings.theme])

  const stats = useMemo(() => buildMockStats(), [])

  const trips = useMemo(() => loadTrips(), [])
  const savedTours = useMemo(() => trips.slice().reverse().slice(0, 10), [trips])

  const onToggleTag = (tagId: UserTagId) => {
    const next = selectedTags.includes(tagId) ? selectedTags.filter((t) => t !== tagId) : [...selectedTags, tagId]
    setSelectedTags(next)
    if (!profile.interests) return
    const nextInterests = buildInterestsFromUserTagIds(profile.interests, next)
    const nextProfile: AuthProfile = { ...profile, interests: nextInterests }
    saveProfile(nextProfile)
    props.onUpdate(nextProfile)
  }

  const availableToAdd = USER_TAGS.filter((t) => !selectedTags.includes(t.id))

  if (profile.role !== 'traveler') {
    return (
      <div className="page">
        <h2>Профиль партнёра</h2>
        <p style={{ opacity: 0.85 }}>Для MVP используем заглушку.</p>
      </div>
    )
  }

  if (!profile.interests) {
    return (
      <div className="page">
        <h2>Профиль</h2>
        <p style={{ opacity: 0.85, marginTop: 8 }}>Заполните опрос интересов, чтобы карта и рекомендации работали.</p>
        <InterestWizard
          initialInterests={undefined}
          onComplete={(nextInterests) => {
            const nextProfile: AuthProfile = { ...profile, interests: nextInterests }
            saveProfile(nextProfile)
            props.onUpdate(nextProfile)
          }}
        />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="profileHeader">
        <div className="profileIdentity">
          <div className="avatar" aria-label="Аватар">
            А
          </div>
          <div>
            <div className="profileName">Анна Смирнова</div>
            <div style={{ opacity: 0.78, marginTop: 4, fontWeight: 750 }}>{profile.email}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="secondaryBtn" onClick={() => setEditMode((v) => !v)}>
            Редактировать профиль
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="blockTitle">Мои интересы</div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {USER_TAGS.map((t) => {
            const active = selectedTags.includes(t.id)
            return (
              <span
                key={t.id}
                className="tagChip"
                style={{
                  borderColor: active ? 'rgba(22,163,74,0.65)' : undefined,
                  background: active ? 'rgba(22,163,74,0.12)' : undefined,
                  opacity: editMode ? 1 : active ? 0.95 : 0.6,
                  cursor: editMode ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (!editMode) return
                  onToggleTag(t.id)
                }}
                role="button"
                tabIndex={0}
              >
                {t.label}
                {editMode && active && <span className="tagChipRemove"> ×</span>}
              </span>
            )
          })}
        </div>

        {editMode && (
          <div style={{ marginTop: 10 }}>
            <div className="smallLabel" style={{ marginBottom: 8 }}>
              Добавить ещё
            </div>
            {availableToAdd.length ? (
              <select
                className="input"
                value=""
                onChange={(e) => {
                  const val = e.target.value as UserTagId
                  if (!val) return
                  onToggleTag(val)
                  e.currentTarget.value = ''
                }}
                aria-label="Добавить тег"
              >
                <option value="" disabled>
                  Выберите тег
                </option>
                {availableToAdd.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ opacity: 0.75 }}>Все доступные теги уже добавлены.</div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="blockTitle">Статистика</div>
        <div className="statsGrid">
          <div className="card" style={{ padding: 14 }}>
            <div style={{ opacity: 0.78, fontWeight: 850 }}>Сохранённых туров</div>
            <div className="statCardValue">{stats.savedTrips}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ opacity: 0.78, fontWeight: 850 }}>Посещённых мест</div>
            <div className="statCardValue">{stats.visitedPlaces}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ opacity: 0.78, fontWeight: 850 }}>Дней в поездках</div>
            <div className="statCardValue">{stats.days}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ opacity: 0.78, fontWeight: 850 }}>Регионов Краснодарского края</div>
            <div className="statCardValue">{stats.regions}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="blockTitle">Мои туры</div>
        <div className="toursRow" aria-label="Мои туры">
          {savedTours.length ? (
            savedTours.map((trip) => {
              const v = trip.routeVariants[0]
              const start = trip.createdAt
              const end = trip.createdAt + trip.days * 86400000
              return (
                <div key={trip.id} className="card" style={{ padding: 12, minWidth: 280, maxWidth: 360 }}>
                  <div style={{ fontWeight: 1000 }}>{v?.title ?? 'Маршрут'}</div>
                  <div style={{ opacity: 0.78, marginTop: 6, fontWeight: 750 }}>
                    {formatISODate(start)} — {formatISODate(end)}
                  </div>
                  <div style={{ opacity: 0.78, marginTop: 6, fontWeight: 750 }}>
                    {v ? 'от 28 000 ₽' : 'от 25 000 ₽'}
                  </div>
                  <button
                    type="button"
                    className="primaryBtn"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      if (!v?.placeIds?.length) return
                      navigate('/map', { state: { placeIds: v.placeIds } })
                    }}
                  >
                    Открыть
                  </button>
                </div>
              )
            })
          ) : (
            <div style={{ opacity: 0.78 }}>Пока нет сохранённых туров. Сгенерируйте маршрут в разделе “Сгенерировать тур”.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="blockTitle">Настройки</div>

        <div className="settingsGrid">
          <label className="toggleRow">
            <span className="smallLabel">Новые туры</span>
            <input
              type="checkbox"
              checked={settings.notifications.newTours}
              onChange={(e) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, newTours: e.target.checked } }))}
            />
          </label>

          <label className="toggleRow">
            <span className="smallLabel">Спецпредложения</span>
            <input
              type="checkbox"
              checked={settings.notifications.deals}
              onChange={(e) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, deals: e.target.checked } }))}
            />
          </label>

          <label className="toggleRow">
            <span className="smallLabel">Погода в поездке</span>
            <input
              type="checkbox"
              checked={settings.notifications.weather}
              onChange={(e) => setSettings((s) => ({ ...s, notifications: { ...s.notifications, weather: e.target.checked } }))}
            />
          </label>

          <label className="toggleRow" style={{ alignItems: 'flex-end' }}>
            <span className="smallLabel">Предпочитаемый бюджет</span>
            <select
              className="input"
              value={settings.budget}
              onChange={(e) => setSettings((s) => ({ ...s, budget: e.target.value as BudgetId }))}
            >
              <option value="economy">Эконом</option>
              <option value="comfort">Комфорт</option>
              <option value="premium">Премиум</option>
            </select>
          </label>

          <label className="toggleRow" style={{ alignItems: 'flex-end' }}>
            <span className="smallLabel">Язык интерфейса</span>
            <select
              className="input"
              value={settings.language}
              onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value as 'ru' | 'en' }))}
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </label>

          <label className="toggleRow" style={{ alignItems: 'flex-end' }}>
            <span className="smallLabel">Тема</span>
            <select
              className="input"
              value={settings.theme}
              onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value as 'light' | 'dark' }))}
            >
              <option value="light">Светлая</option>
              <option value="dark">Тёмная</option>
            </select>
          </label>
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="secondaryBtn"
            style={{ width: '100%' }}
            onClick={() => {
              clearProfile()
              navigate('/')
            }}
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  )
}

