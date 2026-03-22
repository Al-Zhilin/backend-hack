import type { ActivityLevelId, CompanionId, Interests, PlaceTypeId, VacationTypeId } from '../types'
import type { Location } from '../data/locations'

function activityRank(level: ActivityLevelId) {
  switch (level) {
    case 'low':
      return 1
    case 'medium':
      return 2
    case 'high':
      return 3
  }
}

export function scoreLocation(location: Location, interests: Interests) {
  let score = 0

  // Q2: типы мест (если не пропущены)
  if (interests.placeTypes?.length) {
    const matches = location.placeTypes.filter((t) => interests.placeTypes.includes(t)).length
    score += matches * 10
  }

  // Q1: формат отдыха
  const vacationMatches = location.vacationTypes.filter((t) => interests.vacationTypes.includes(t)).length
  score += vacationMatches * 4

  // Q4: сезон
  if (interests.season === 'any' || location.seasons.includes(interests.season)) score += 12

  // Q5: активность (мягкая совместимость)
  const desired = interests.activityLevel
  const desiredRank = activityRank(desired)
  const actualRank = activityRank(location.activity)
  if (actualRank === desiredRank) score += 10
  else if (actualRank < desiredRank) score += 5
  else if (actualRank > desiredRank) score -= 6

  // Q3: с кем едете
  const companionToSuitable: Record<CompanionId, Location['suitableFor'][number]> = {
    solo: 'friends',
    couple: 'couple',
    family: 'family',
    elder: 'elder',
    friends: 'friends',
    freelancers: 'freelancers',
  }

  const desiredSuitable = companionToSuitable[interests.companions]
  if (location.suitableFor.includes(desiredSuitable)) score += 8

  // Небольшая “бонусная” подсказка: гастро/вино часто выигрывают
  const preferredIds: VacationTypeId[] = ['gastro', 'wine']
  const hasPreferred = preferredIds.some((id) => interests.vacationTypes.includes(id))
  if (hasPreferred && (interests.vacationTypes.includes('gastro') || interests.vacationTypes.includes('wine'))) {
    const hasLocationType = location.vacationTypes.some((t) => t === 'gastro' || t === 'wine')
    if (hasLocationType) score += 4
  }

  // Если Q2 пропущен — не теряем приоритеты по Q1
  // (уже учтено сверху, но можно чуть усилить)
  if (!interests.placeTypes?.length && vacationMatches > 0) score += 6

  return score
}

export function pickRoutePlaceIds(locations: Location[], interests: Interests, days: number) {
  const scored = locations
    .map((loc) => ({ loc, score: scoreLocation(loc, interests) }))
    .sort((a, b) => b.score - a.score)

  const picked: string[] = []
  const pickedSet = new Set<string>()

  // Простая жадная стратегия с “разнообразием”: на каждом шаге берем лучший, но
  // избегаем повторения по ключевым типам.
  const keyTypeOf = (loc: Location): PlaceTypeId | null => {
    // приоритет “интересных” типов
    const priority: PlaceTypeId[] = [
      'wineries',
      'cheese_farms',
      'eco_farms',
      'restaurants_cafes',
      'kids_entertainment',
      'guest_houses',
      'cultural_sites',
      'cossack_stations',
      'reserves',
      'trekking_routes',
      'festivals',
    ]
    return priority.find((p) => loc.placeTypes.includes(p)) ?? null
  }

  const pickedKeyTypes = new Set<PlaceTypeId>()

  for (let day = 0; day < days; day++) {
    const candidates = scored
      .filter((s) => !pickedSet.has(s.loc.id))
      .map((s) => s.loc)

    if (!candidates.length) break

    let chosen = candidates[0]
    // пробуем найти лучший “по ключевому типу”, который еще не взят
    for (const c of candidates) {
      const k = keyTypeOf(c)
      if (k && !pickedKeyTypes.has(k)) {
        chosen = c
        break
      }
    }

    picked.push(chosen.id)
    pickedSet.add(chosen.id)
    const k = keyTypeOf(chosen)
    if (k) pickedKeyTypes.add(k)
  }

  return picked
}

