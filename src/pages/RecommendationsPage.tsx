import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { AuthProfile, SeasonId } from '../types'
import type { Location } from '../data/locations'
import { LOCATIONS } from '../data/locations'
import { scoreLocation } from '../utils/scoring'
import {
  getLocationRussianTags,
  getLocationUserTagIds,
  deriveUserTagIdsFromInterests,
  type UserTagId,
  USER_TAGS,
} from '../utils/userTagMapping'

import PlaceModal from '../components/generate/PlaceModal'

import '../styles/recommendations.scss'

const SEASON_OPTIONS: Array<{ id: SeasonId; label: string }> = [
  { id: 'winter', label: 'Зима' },
  { id: 'spring', label: 'Весна' },
  { id: 'summer', label: 'Лето' },
  { id: 'autumn', label: 'Осень' },
]

type AvailabilityId = 'family' | 'kids' | 'elder' | 'freelancers' | 'companies'

type MoodId = 'active' | 'calm' | 'romantic' | 'adventure' | 'gastro'

const AVAILABILITY: Array<{ id: AvailabilityId; label: string }> = [
  { id: 'family', label: 'Семейный' },
  { id: 'kids', label: 'Для детей' },
  { id: 'elder', label: 'Для пожилых' },
  { id: 'freelancers', label: 'Для фрилансеров' },
  { id: 'companies', label: 'Для компаний' },
]

const MOODS: Array<{ id: MoodId; label: string }> = [
  { id: 'active', label: 'Активный' },
  { id: 'calm', label: 'Спокойный' },
  { id: 'romantic', label: 'Романтический' },
  { id: 'adventure', label: 'Приключенческий' },
  { id: 'gastro', label: 'Гастрономический' },
]

function russianSeasonLabel(season: SeasonId) {
  return SEASON_OPTIONS.find((s) => s.id === season)?.label ?? 'Любой сезон'
}

function seasonFromDate(d: Date): SeasonId {
  const m = d.getMonth() // 0-11
  // приближенно: зима [11,0,1], весна [2,3,4], лето [5,6,7], осень [8,9,10]
  if (m === 11 || m === 0 || m === 1) return 'winter'
  if (m >= 2 && m <= 4) return 'spring'
  if (m >= 5 && m <= 7) return 'summer'
  return 'autumn'
}

function durationForLocation(loc: Location) {
  if (loc.activity === 'high') return 4
  if (loc.activity === 'medium') return 3
  return 2
}

function priceForLocation(loc: Location) {
  if (loc.placeTypes.includes('wineries')) return 'от 25 000 ₽'
  if (loc.placeTypes.includes('trekking_routes')) return 'от 18 000 ₽'
  if (loc.placeTypes.includes('eco_farms') || loc.placeTypes.includes('cheese_farms')) return 'от 16 000 ₽'
  return 'от 12 000 ₽'
}

function matchesAvailability(loc: Location, ids: AvailabilityId[]) {
  if (!ids.length) return true
  const has = (suitable: Location['suitableFor'][number]) => loc.suitableFor.includes(suitable)

  return ids.every((id) => {
    switch (id) {
      case 'family':
        return loc.vacationTypes.includes('family') || has('family')
      case 'kids':
        return loc.vacationTypes.includes('family') || has('family')
      case 'elder':
        return has('elder')
      case 'freelancers':
        return has('freelancers')
      case 'companies':
        return has('friends')
    }
  })
}

function matchesMood(loc: Location, ids: MoodId[]) {
  if (!ids.length) return true
  return ids.every((id) => {
    switch (id) {
      case 'active':
        return loc.activity === 'high' || loc.vacationTypes.includes('active') || loc.vacationTypes.includes('mountains')
      case 'calm':
        return loc.activity === 'low' || loc.vacationTypes.includes('nature') || loc.vacationTypes.includes('wellness')
      case 'romantic':
        return loc.vacationTypes.includes('wine') || loc.placeTypes.includes('wineries') || loc.vacationTypes.includes('sea')
      case 'adventure':
        return loc.placeTypes.includes('trekking_routes') || loc.activity === 'high'
      case 'gastro':
        return loc.vacationTypes.includes('gastro') || loc.vacationTypes.includes('wine')
    }
  })
}

function matchesSeason(loc: Location, seasons: SeasonId[]) {
  if (!seasons.length) return true
  return seasons.some((s) => loc.seasons.includes(s))
}

function matchesTags(loc: Location, tagIds: UserTagId[]) {
  if (!tagIds.length) return true
  const locTagIds = getLocationUserTagIds(loc)
  return tagIds.some((t) => locTagIds.includes(t))
}

export default function RecommendationsPage(props: { profile: AuthProfile }) {
  const navigate = useNavigate()
  const interests = props.profile.interests

  const defaultSeason: SeasonId = interests?.season && interests.season !== 'any' ? interests.season : seasonFromDate(new Date())

  const [tagFilter, setTagFilter] = useState<UserTagId[]>(() => (interests ? deriveUserTagIdsFromInterests(interests) : []))
  const [availability, setAvailability] = useState<AvailabilityId[]>([])
  const [seasons, setSeasons] = useState<SeasonId[]>([])
  const [moods, setMoods] = useState<MoodId[]>([])

  const userTagIds = useMemo(() => {
    if (!interests) return []
    return deriveUserTagIdsFromInterests(interests)
  }, [interests])

  const visible = useMemo(() => {
    if (!interests) return []
    const all = LOCATIONS
      .map((loc) => ({ loc, score: scoreLocation(loc, interests) }))
      .filter(({ loc }) => matchesTags(loc, tagFilter) && matchesAvailability(loc, availability) && matchesSeason(loc, seasons) && matchesMood(loc, moods))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.loc)

    return all
  }, [availability, interests, moods, seasons, tagFilter])

  const personalPicks = useMemo(() => visible.slice(0, 10), [visible])
  const weekendPicks = useMemo(() => {
    const weekend = visible.filter((l) => durationForLocation(l) <= 3)
    return weekend.length ? weekend.slice(0, 8) : visible.slice(0, 8)
  }, [visible])
  const popularPicks = useMemo(() => visible.slice(0, 9), [visible])

  const [modalOpen, setModalOpen] = useState(false)
  const [modalPoint, setModalPoint] = useState<{
    id: string
    name: string
    address: string
    lat: number
    lng: number
    description: string
    tags: string[]
    photoUrl?: string
  } | null>(null)

  const modalTags = (loc: Location) => getLocationRussianTags(loc).slice(0, 5)

  const openModalForLocation = (loc: Location) => {
    setModalPoint({
      id: loc.id,
      name: loc.name,
      address: loc.address ?? '—',
      lat: loc.lat,
      lng: loc.lng,
      description: loc.aiFullDescription ?? loc.description,
      tags: modalTags(loc),
      photoUrl: loc.photos?.[0] ?? loc.photoUrl,
    })
    setModalOpen(true)
  }

  if (!interests) {
    return (
      <div className="page">
        <h2>Рекомендации сезона</h2>
        <p style={{ opacity: 0.85, marginTop: 8 }}>Заполните интересы в профиле, чтобы рекомендации стали персональными.</p>
        <button type="button" className="primaryBtn" onClick={() => navigate('/profile')}>
          Перейти в профиль
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <h2>Рекомендации сезона</h2>
      <p style={{ opacity: 0.9, marginTop: 6 }}>Под ваш сезон: {russianSeasonLabel(defaultSeason)}</p>

      <div className="filtersBar" style={{ marginTop: 14 }}>
        <div>
          <div className="blockTitle" style={{ marginBottom: 8 }}>
            По тегам
          </div>
          <div className="filtersRow">
            <span
              className={`filterChip ${tagFilter.length === 0 ? 'active' : ''}`}
              onClick={() => setTagFilter([])}
              role="button"
              tabIndex={0}
            >
              Все
            </span>
            {userTagIds.map((id) => {
              const label = USER_TAGS.find((t) => t.id === id)?.label ?? id
              const active = tagFilter.includes(id)
              return (
                <span
                  key={id}
                  className={`filterChip ${active ? 'active' : ''}`}
                  onClick={() => setTagFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
                  role="button"
                  tabIndex={0}
                >
                  {label}
                </span>
              )
            })}
          </div>
        </div>

        <div>
          <div className="blockTitle" style={{ marginBottom: 8 }}>
            По доступности
          </div>
          <div className="filtersRow">
            {AVAILABILITY.map((a) => {
              const active = availability.includes(a.id)
              return (
                <span
                  key={a.id}
                  className={`filterChip ${active ? 'active' : ''}`}
                  onClick={() => setAvailability((prev) => (prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]))}
                  role="button"
                  tabIndex={0}
                >
                  {a.label}
                </span>
              )
            })}
          </div>
        </div>

        <div>
          <div className="blockTitle" style={{ marginBottom: 8 }}>
            По сезону
          </div>
          <div className="filtersRow">
            {SEASON_OPTIONS.map((s) => {
              const active = seasons.includes(s.id)
              return (
                <span
                  key={s.id}
                  className={`filterChip ${active ? 'active' : ''}`}
                  onClick={() => setSeasons((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                  role="button"
                  tabIndex={0}
                >
                  {s.label}
                </span>
              )
            })}
          </div>
        </div>

        <div>
          <div className="blockTitle" style={{ marginBottom: 8 }}>
            По настроению
          </div>
          <div className="filtersRow">
            {MOODS.map((m) => {
              const active = moods.includes(m.id)
              return (
                <span
                  key={m.id}
                  className={`filterChip ${active ? 'yellowActive' : ''}`}
                  onClick={() => setMoods((prev) => (prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
                  role="button"
                  tabIndex={0}
                >
                  {m.label}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="blockTitle">Персональные подборки</div>
        <div className="recoGrid personal">
          {personalPicks.map((loc) => {
            const photo = loc.photos?.[0] ?? loc.photoUrl
            const duration = durationForLocation(loc)
            const tags = getLocationRussianTags(loc).slice(0, 4)
            return (
              <div key={loc.id} className="recoCard">
                <img className="recoCardImg" src={photo} alt={loc.name} />
                <div className="recoCardBody">
                  <div className="recoCardTitle">{loc.name}</div>
                  <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.35 }}>{loc.description}</div>
                  <div className="recoChips">
                    {tags.map((t) => (
                      <span key={t} className="recoTag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div style={{ opacity: 0.8, marginTop: 10, fontWeight: 850 }}>
                    {duration} дн. • {priceForLocation(loc)}
                  </div>
                  <button type="button" className="primaryBtn" style={{ marginTop: 10 }} onClick={() => openModalForLocation(loc)}>
                    Подробнее
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="blockTitle">Быстрые туры на выходные</div>
        <div className="recoRowScroll">
          {weekendPicks.map((loc) => {
            const photo = loc.photos?.[0] ?? loc.photoUrl
            const duration = durationForLocation(loc)
            const tags = getLocationRussianTags(loc).slice(0, 3)
            return (
              <div key={loc.id} className="recoCard" style={{ minWidth: 290, maxWidth: 340 }}>
                <img className="recoCardImg" src={photo} alt={loc.name} style={{ height: 120 }} />
                <div className="recoCardBody">
                  <div className="recoCardTitle">{loc.name}</div>
                  <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.35 }}>{loc.description}</div>
                  <div className="recoChips">
                    {tags.map((t) => (
                      <span key={t} className="recoTag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div style={{ opacity: 0.8, marginTop: 10, fontWeight: 850 }}>
                    {duration} дн. • {priceForLocation(loc)}
                  </div>
                  <button type="button" className="secondaryBtn" style={{ marginTop: 10 }} onClick={() => openModalForLocation(loc)}>
                    Подробнее
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="blockTitle">Популярные локации по вашим интересам</div>
        <div className="recoGrid popular">
          {popularPicks.map((loc) => {
            const photo = loc.photos?.[0] ?? loc.photoUrl
            const duration = durationForLocation(loc)
            const tags = getLocationRussianTags(loc).slice(0, 4)
            return (
              <div key={loc.id} className="recoCard">
                <img className="recoCardImg" src={photo} alt={loc.name} />
                <div className="recoCardBody">
                  <div className="recoCardTitle">{loc.name}</div>
                  <div style={{ opacity: 0.85, marginTop: 6, lineHeight: 1.35 }}>{loc.description}</div>
                  <div className="recoChips">
                    {tags.map((t) => (
                      <span key={t} className="recoTag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div style={{ opacity: 0.8, marginTop: 10, fontWeight: 850 }}>
                    {duration} дн. • {priceForLocation(loc)}
                  </div>
                  <button type="button" className="primaryBtn" style={{ marginTop: 10 }} onClick={() => openModalForLocation(loc)}>
                    Подробнее
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Модальное окно */}
      <PlaceModal open={modalOpen} point={modalPoint as any} onClose={() => setModalOpen(false)} />
    </div>
  )
}

