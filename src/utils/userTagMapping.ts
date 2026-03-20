import type { Interests, PlaceTypeId, VacationTypeId } from '../types'
import type { Location } from '../data/locations'

export type UserTagId =
  | 'wine_gastro'
  | 'agro'
  | 'family_kids'
  | 'trek_active'
  | 'eco_tourism'
  | 'cossack_stations'
  | 'wineries'
  | 'wellness'

export type UserTag = {
  id: UserTagId
  label: string
}

export const USER_TAGS: UserTag[] = [
  { id: 'wine_gastro', label: 'Вино и гастрономия' },
  { id: 'agro', label: 'Агротуризм' },
  { id: 'family_kids', label: 'Семья с детьми' },
  { id: 'trek_active', label: 'Трекинг и активный отдых' },
  { id: 'eco_tourism', label: 'Эко-туризм' },
  { id: 'cossack_stations', label: 'Казачьи станицы' },
  { id: 'wineries', label: 'Винодельни' },
  { id: 'wellness', label: 'Оздоровление' },
]

const tagToInterests = (tagId: UserTagId, fallback: NonNullable<Interests>): Partial<Interests> => {
  switch (tagId) {
    case 'wine_gastro':
      return {
        vacationTypes: Array.from(new Set([...fallback.vacationTypes, 'wine', 'gastro'])) as VacationTypeId[],
        placeTypes: fallback.placeTypes,
      }
    case 'agro':
      return {
        vacationTypes: fallback.vacationTypes,
        placeTypes: Array.from(new Set([...fallback.placeTypes, 'cheese_farms', 'eco_farms'])) as PlaceTypeId[],
      }
    case 'family_kids':
      return {
        vacationTypes: Array.from(new Set([...fallback.vacationTypes, 'family'])) as VacationTypeId[],
        companions: 'family',
      }
    case 'trek_active':
      return {
        vacationTypes: Array.from(new Set([...fallback.vacationTypes, 'active', 'mountains'])) as VacationTypeId[],
        activityLevel: 'high',
      }
    case 'eco_tourism':
      return {
        vacationTypes: Array.from(new Set([...fallback.vacationTypes, 'nature'])) as VacationTypeId[],
        placeTypes: Array.from(new Set([...fallback.placeTypes, 'eco_farms'])) as PlaceTypeId[],
      }
    case 'cossack_stations':
      return {
        placeTypes: Array.from(new Set([...fallback.placeTypes, 'cossack_stations'])) as PlaceTypeId[],
      }
    case 'wineries':
      return {
        placeTypes: Array.from(new Set([...fallback.placeTypes, 'wineries'])) as PlaceTypeId[],
      }
    case 'wellness':
      return {
        vacationTypes: Array.from(new Set([...fallback.vacationTypes, 'wellness'])) as VacationTypeId[],
      }
  }
}

function unionArrays<T>(...arrs: Array<T[] | undefined>) {
  const out = new Set<T>()
  for (const a of arrs) {
    for (const x of a ?? []) out.add(x)
  }
  return Array.from(out)
}

export function deriveUserTagIdsFromInterests(interests: NonNullable<Interests>): UserTagId[] {
  const ids: UserTagId[] = []

  const { vacationTypes, placeTypes, companions, activityLevel } = interests
  const has = (xs: string[], idsList: string[]) => xs.some((x) => idsList.includes(x))

  if (has(vacationTypes, ['wine', 'gastro'])) ids.push('wine_gastro')
  if (has(placeTypes, ['cheese_farms', 'eco_farms'])) ids.push('agro')
  if (vacationTypes.includes('family') || companions === 'family') ids.push('family_kids')
  if (has(vacationTypes, ['active', 'mountains']) || activityLevel === 'high') ids.push('trek_active')
  if (has(vacationTypes, ['nature']) || placeTypes.includes('eco_farms')) ids.push('eco_tourism')
  if (placeTypes.includes('cossack_stations')) ids.push('cossack_stations')
  if (placeTypes.includes('wineries')) ids.push('wineries')
  if (vacationTypes.includes('wellness')) ids.push('wellness')

  return ids
}

export function buildInterestsFromUserTagIds(interests: NonNullable<Interests>, selected: UserTagId[]): NonNullable<Interests> {
  if (selected.length === 0) return interests

  const base = interests
  // Начинаем с “чистого” набора для предсказуемости.
  let vacationTypes: VacationTypeId[] = []
  let placeTypes: PlaceTypeId[] = []
  let activityLevel = base.activityLevel
  let companions = base.companions

  for (const tagId of selected) {
    const patch = tagToInterests(tagId, base)

    vacationTypes = unionArrays(vacationTypes, patch.vacationTypes as VacationTypeId[]).filter(Boolean) as VacationTypeId[]
    placeTypes = unionArrays(placeTypes, patch.placeTypes as PlaceTypeId[]).filter(Boolean) as PlaceTypeId[]
    if (patch.activityLevel) activityLevel = patch.activityLevel
    if (patch.companions) companions = patch.companions
  }

  return {
    ...base,
    vacationTypes: vacationTypes.length ? vacationTypes : base.vacationTypes,
    placeTypes: placeTypes.length ? placeTypes : base.placeTypes,
    activityLevel,
    companions,
  }
}

export function getLocationRussianTags(location: Location): string[] {
  const ids: UserTagId[] = []
  if (location.vacationTypes.includes('wine') || location.vacationTypes.includes('gastro')) ids.push('wine_gastro')
  if (location.placeTypes.includes('cheese_farms') || location.placeTypes.includes('eco_farms')) ids.push('agro')
  if (location.vacationTypes.includes('family') || location.suitableFor.includes('family')) ids.push('family_kids')
  if (location.vacationTypes.includes('active') || location.vacationTypes.includes('mountains') || location.activity === 'high') ids.push('trek_active')
  if (location.vacationTypes.includes('nature') || location.placeTypes.includes('eco_farms')) ids.push('eco_tourism')
  if (location.placeTypes.includes('cossack_stations')) ids.push('cossack_stations')
  if (location.placeTypes.includes('wineries')) ids.push('wineries')
  if (location.vacationTypes.includes('wellness')) ids.push('wellness')

  const idSet = new Set(ids)
  return USER_TAGS.filter((t) => idSet.has(t.id)).map((t) => t.label)
}

export function getLocationUserTagIds(location: Location): UserTagId[] {
  const ids: UserTagId[] = []

  if (location.vacationTypes.includes('wine') || location.vacationTypes.includes('gastro')) ids.push('wine_gastro')
  if (location.placeTypes.includes('cheese_farms') || location.placeTypes.includes('eco_farms')) ids.push('agro')
  if (location.vacationTypes.includes('family') || location.suitableFor.includes('family')) ids.push('family_kids')
  if (location.vacationTypes.includes('active') || location.vacationTypes.includes('mountains') || location.activity === 'high')
    ids.push('trek_active')
  if (location.vacationTypes.includes('nature') || location.placeTypes.includes('eco_farms')) ids.push('eco_tourism')
  if (location.placeTypes.includes('cossack_stations')) ids.push('cossack_stations')
  if (location.placeTypes.includes('wineries')) ids.push('wineries')
  if (location.vacationTypes.includes('wellness')) ids.push('wellness')

  return Array.from(new Set(ids))
}

export function getBudgetLabel(value: 'economy' | 'comfort' | 'premium') {
  switch (value) {
    case 'economy':
      return 'Эконом'
    case 'comfort':
      return 'Комфорт'
    case 'premium':
      return 'Премиум'
  }
}

