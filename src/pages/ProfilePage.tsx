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

// Компонент-заглушка для статистики
function StatsPlaceholder() {
  return (
    <div className="statsGrid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card" style={{ padding: 14 }}>
          <div className="skeleton" style={{ height: 20, width: '70%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 32, width: '50%' }} />
        </div>
      ))}
    </div>
  )
}

// Компонент-заглушка для туров
function TripsPlaceholder() {
  return (
    <div className="toursRow">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card" style={{ padding: 12, minWidth: 280, maxWidth: 360 }}>
          <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 18, width: '80%', marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 18, width: '50%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 36, width: '100%' }} />
        </div>
      ))}
    </div>
  )
}

// Компонент-заглушка для интересов
function InterestsPlaceholder() {
  return (
    <div>
      <div className="blockTitle">Мои интересы</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton" style={{ height: 32, width: 80, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}

export default function ProfilePage(props: { profile: AuthProfile; onUpdate: (p: AuthProfile) => void }) {
  const navigate = useNavigate()
  const { profile } = props

  const [editMode, setEditMode] = useState(true)
  const [settings, setSettings] = useState<ProfileSettings>(() => loadSettings())
  const [isLoading, setIsLoading] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

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
    
    // Показываем сообщение о сохранении
    setSaveMessage('Интересы сохранены')
    setTimeout(() => setSaveMessage(null), 2000)
  }

  const handleSaveSettings = async () => {
    setIsLoading(true)
    // Имитация сохранения настроек на сервере
    await new Promise(resolve => setTimeout(resolve, 500))
    setIsLoading(false)
    setSaveMessage('Настройки сохранены')
    setTimeout(() => setSaveMessage(null), 2000)
  }

  const availableToAdd = USER_TAGS.filter((t) => !selectedTags.includes(t.id))

  if (profile.role !== 'traveler') {
    return (
      <div className="page">
        <div className="profileHeader">
          <div className="profileIdentity">
            <div className="avatar" aria-label="Аватар">
              {(profile.interests?.displayName || profile.email || 'П').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="profileName">{profile.interests?.displayName || profile.email || 'Партнер'}</div>
              <div style={{ opacity: 0.78, marginTop: 4, fontWeight: 750 }}>{profile.email}</div>
            </div>
          </div>
        </div>
        
        <div className="card" style={{ padding: 20, marginTop: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <h3 style={{ marginBottom: 8 }}>Личный кабинет партнера</h3>
          <p style={{ opacity: 0.75, marginBottom: 16 }}>
            Здесь будут отображаться ваши туристические предложения, статистика бронирований и инструменты для управления контентом.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="primaryBtn" onClick={() => navigate('/')}>
              На главную
            </button>
            <button 
              className="secondaryBtn" 
              onClick={() => {
                clearProfile()
                navigate('/')
              }}
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!profile.interests) {
    return (
      <div className="page">
        <div className="profileHeader">
          <div className="profileIdentity">
            <div className="avatar" aria-label="Аватар">
              {(profile.email || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="profileName">{profile.email || 'Путешественник'}</div>
              <div style={{ opacity: 0.78, marginTop: 4, fontWeight: 750 }}>{profile.email}</div>
            </div>
          </div>
        </div>
        
        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Добро пожаловать! 👋</h2>
          <p style={{ opacity: 0.85, marginBottom: 20 }}>
            Заполните опрос интересов, чтобы мы могли подбирать для вас лучшие туры и маршруты по Краснодарскому краю.
          </p>
          <InterestWizard
            initialInterests={undefined}
            onComplete={(nextInterests) => {
              const nextProfile: AuthProfile = { ...profile, interests: nextInterests }
              saveProfile(nextProfile)
              props.onUpdate(nextProfile)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {saveMessage && (
        <div className="toast" style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          background: '#10b981',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 8,
          zIndex: 1000,
          animation: 'slideIn 0.3s ease-out'
        }}>
          {saveMessage}
        </div>
      )}
      
      <div className="profileHeader">
        <div className="profileIdentity">
          <div className="avatar" aria-label="Аватар">
            {(profile.interests?.displayName || profile.email || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="profileName">{profile.interests?.displayName || profile.email || 'Путешественник'}</div>
            <div style={{ opacity: 0.78, marginTop: 4, fontWeight: 750 }}>{profile.email}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="secondaryBtn" onClick={() => setEditMode((v) => !v)}>
            {editMode ? 'Сохранить' : 'Редактировать'}
          </button>
        </div>
      </div>

      {/* Интересы */}
      <div style={{ marginTop: 18 }}>
        {selectedTags.length > 0 ? (
          <>
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
                      transition: 'all 0.2s ease'
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
                  <div style={{ opacity: 0.75, padding: '8px 0' }}>Все доступные теги уже добавлены.</div>
                )}
              </div>
            )}
          </>
        ) : (
          <InterestsPlaceholder />
        )}
      </div>

      {/* Статистика */}
      <div style={{ marginTop: 18 }}>
        <div className="blockTitle">Статистика путешествий</div>
        <div className="statsGrid">
          <div className="card" style={{ padding: 14 }}>
            <div style={{ opacity: 0.78, fontWeight: 850 }}>Сохранённых туров</div>
            <div className="statCardValue">{stats.savedTrips}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ opacity: 0.78, fontWeight: 850 }}>Посещённых мест</div>
            <div className="statCardValue">{stats.visitedPlaces}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>скоро будут доступны</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ opacity: 0.78, fontWeight: 850 }}>Дней в поездках</div>
            <div className="statCardValue">{stats.days}</div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ opacity: 0.78, fontWeight: 850 }}>Регионов Краснодарского края</div>
            <div className="statCardValue">{stats.regions}</div>
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>из 44 муниципальных образований</div>
          </div>
        </div>
      </div>

      {/* Мои туры */}
      <div style={{ marginTop: 18 }}>
        <div className="blockTitle">Мои туры</div>
        {savedTours.length > 0 ? (
          <div className="toursRow" aria-label="Мои туры">
            {savedTours.map((trip) => {
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
                      if (!v?.placeIds?.length) {
                        // Заглушка для отсутствующих мест
                        alert('Детали маршрута будут доступны в ближайшее время')
                        return
                      }
                      navigate('/map', { state: { placeIds: v.placeIds } })
                    }}
                  >
                    Открыть маршрут
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <TripsPlaceholder />
        )}
      </div>

      {/* Настройки */}
      <div style={{ marginTop: 18 }}>
        <div className="blockTitle">Настройки профиля</div>

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
            <span className="smallLabel">Тема оформления</span>
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

        <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
          <button
            type="button"
            className="secondaryBtn"
            style={{ flex: 1 }}
            onClick={handleSaveSettings}
            disabled={isLoading}
          >
            {isLoading ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
          
          <button
            type="button"
            className="secondaryBtn"
            style={{ flex: 1 }}
            onClick={() => {
              clearProfile()
              navigate('/')
            }}
          >
            Выйти из аккаунта
          </button>
        </div>
        
        <div className="card" style={{ marginTop: 16, padding: 12, textAlign: 'center', opacity: 0.7 }}>
          <small>Версия 1.0.0-beta | Поддержка: support@kubansmotry.ru</small>
        </div>
      </div>
    </div>
  )
}