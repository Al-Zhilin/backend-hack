import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { AuthProfile, GeneratedTrip, SeasonId } from '../types'
import type { Location } from '../data/locations'
import { LOCATIONS } from '../data/locations'
import { loadTrips, saveTrips } from '../utils/storage'
import { pickRoutePlaceIds, scoreLocation } from '../utils/scoring'

type RouteVariant = GeneratedTrip['routeVariants'][number]

const SEASON_OPTIONS: Array<{ id: SeasonId; label: string }> = [
  { id: 'spring', label: 'Весна' },
  { id: 'summer', label: 'Лето' },
  { id: 'autumn', label: 'Осень' },
  { id: 'winter', label: 'Зима' },
  { id: 'any', label: 'Любой' },
]

function getById(id: string, locations: Location[]) {
  return locations.find((l) => l.id === id) ?? null
}

function buildTimeline(placeIds: string[], locations: Location[], interests: NonNullable<AuthProfile['interests']>, days: number) {
  const timeline: RouteVariant['timeline'] = []
  for (let day = 0; day < days; day++) {
    const from = getById(placeIds[day], locations)
    const to = getById(placeIds[day + 1], locations)
    if (!from || !to) continue

    const transport =
      interests.activityLevel === 'high' || from.activity === 'high' || to.activity === 'high'
        ? 'Минивэн + тропа'
        : 'Комфортный трансфер'

    const stay = interests.activityLevel === 'high' ? 'Гостевой дом / домик в природе (заглушка)' : 'Эко-гостевой дом (заглушка)'

    const food =
      from.vacationTypes.includes('gastro') || to.vacationTypes.includes('gastro') || from.placeTypes.includes('festivals')
        ? 'Локальная кухня + дегустации (заглушка)'
        : 'Питание по маршруту (заглушка)'

    timeline.push({
      day: day + 1,
      fromPlaceId: from.id,
      toPlaceId: to.id,
      transport,
      stay,
      food,
    })
  }
  return timeline
}

function createVariant(args: {
  locations: Location[]
  interests: NonNullable<AuthProfile['interests']>
  days: number
  bannedTypes?: Array<NonNullable<Location['placeTypes']>[number]>
}): RouteVariant | null {
  const { locations, interests, days, bannedTypes = [] } = args

  const candidates =
    bannedTypes.length > 0 ? locations.filter((l) => !l.placeTypes.some((t) => bannedTypes.includes(t))) : locations

  if (candidates.length < days + 1) return null

  const placeIds = pickRoutePlaceIds(candidates, interests, days + 1)
  if (placeIds.length < days + 1) return null

  const timeline = buildTimeline(placeIds, candidates, interests, days)

  const keyPlaceIds = [
    placeIds[0],
    placeIds[Math.max(1, Math.floor(placeIds.length / 2))],
    placeIds[placeIds.length - 1],
  ]

  const uniqKey = Array.from(new Set(keyPlaceIds)).filter(Boolean)

  const score = placeIds.reduce((sum, id) => {
    const loc = getById(id, candidates)
    if (!loc) return sum
    return sum + scoreLocation(loc, interests)
  }, 0)

  const title = uniqKey
    .map((id) => getById(id, candidates)?.placeTypes[0])
    .filter(Boolean)
    .slice(0, 2)
    .join(' + ')

  return {
    id: (crypto?.randomUUID?.() as string) ?? `variant_${Date.now()}_${Math.random()}`,
    title: title ? `Маршрут: ${title}` : 'Маршрут по интересам',
    placeIds,
    timeline,
    keyPlaceIds: uniqKey,
    score,
  }
}

export default function RouteGenerator(props: { profile: AuthProfile; onPickRoute: (placeIds: string[]) => void }) {
  const navigate = useNavigate()
  const interests = props.profile.interests
  if (!interests) return null

  const [days, setDays] = useState(4)
  const [season, setSeason] = useState<SeasonId>(interests.season ?? 'any')
  const [generated, setGenerated] = useState<RouteVariant[] | null>(null)

  const genInterests = useMemo(() => ({ ...interests, season }), [interests, season])

  const onGenerate = () => {
    const variants: RouteVariant[] = []

    // 3 варианта: разные “степени” диверсификации
    const v0 = createVariant({ locations: LOCATIONS, interests: genInterests, days })
    if (v0) variants.push(v0)

    const v1 = createVariant({ locations: LOCATIONS, interests: genInterests, days, bannedTypes: ['wineries'] })
    if (v1) variants.push(v1)

    const v2 = createVariant({ locations: LOCATIONS, interests: genInterests, days, bannedTypes: ['trekking_routes'] })
    if (v2) variants.push(v2)

    // если слишком одинаковые — просто отрежем
    const uniq = new Map<string, RouteVariant>()
    for (const v of variants) {
      const key = v.placeIds.join('>')
      if (!uniq.has(key)) uniq.set(key, v)
    }

    setGenerated(Array.from(uniq.values()).slice(0, 3))
  }

  return (
    <div className="page">
      <h2>Сгенерировать тур</h2>
      <div style={{ opacity: 0.85, marginTop: 6 }}>Подбор вариантов на основе вашего опроса и выбранного сезона.</div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
        <label className="field" style={{ minWidth: 210 }}>
          <span className="label">Сезон для тура</span>
          <select
            className="input"
            value={season}
            onChange={(e) => setSeason(e.target.value as SeasonId)}
            aria-label="Сезон"
          >
            {SEASON_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field" style={{ minWidth: 210 }}>
          <span className="label">Сколько дней</span>
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d} дня
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="primaryBtn" style={{ height: 46, alignSelf: 'end' }} onClick={onGenerate}>
          Сгенерировать
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        {!generated && <div style={{ opacity: 0.7 }}>Нажмите “Сгенерировать”, чтобы получить 2–3 варианта маршрута.</div>}
        {generated?.map((variant, idx) => (
          <div
            key={variant.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 14,
              marginTop: 12,
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{idx + 1}. {variant.title}</div>
                <div style={{ opacity: 0.75, marginTop: 4 }}>Суммарная “подгонка”: {Math.round(variant.score)}</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="primaryBtn"
                  onClick={() => {
                    // Сохраняем выбор в “путешествия”
                    const trips = loadTrips()
                    const trip: GeneratedTrip = {
                      id: (crypto?.randomUUID?.() as string) ?? `trip_${Date.now()}_${Math.random()}`,
                      createdAt: Date.now(),
                      season,
                      days,
                      routeVariants: [
                        variant,
                      ],
                      pickedVariantId: variant.id,
                    }

                    saveTrips([...trips, trip])
                    props.onPickRoute(variant.placeIds)
                  }}
                >
                  Выбрать маршрут
                </button>
                <button
                  type="button"
                  className="secondaryBtn"
                  onClick={() => navigate(`/vr?placeId=${encodeURIComponent(variant.keyPlaceIds[0])}`)}
                >
                  Посетить дистанционно
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {variant.timeline.map((t) => {
                const from = getById(t.fromPlaceId, LOCATIONS)
                const to = getById(t.toPlaceId, LOCATIONS)
                return (
                  <div
                    key={`${t.day}_${t.fromPlaceId}_${t.toPlaceId}`}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.02)',
                      marginTop: 10,
                    }}
                  >
                    <div style={{ fontWeight: 850 }}>День {t.day}</div>
                    <div style={{ opacity: 0.9, marginTop: 4 }}>
                      {from?.name ?? t.fromPlaceId} → {to?.name ?? t.toPlaceId}
                    </div>
                    <div style={{ opacity: 0.75, marginTop: 6, fontSize: 14 }}>
                      <div>Транспорт: {t.transport}</div>
                      <div>Жилье: {t.stay}</div>
                      <div>Питание: {t.food}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

