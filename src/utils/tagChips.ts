import type { Interests } from '../types'
import type { Location } from '../data/locations'

export type TagChipId =
  | 'wine'
  | 'gastro'
  | 'agro'
  | 'eco'
  | 'trekking'
  | 'festivals'
  | 'wellness'
  | 'culture'
  | 'family'

export type TagChip = {
  id: TagChipId
  label: string

  // Как понять, что локация соответствует чипу
  matchesLocation: (loc: Location) => boolean

  // Какие поля интересов “актуализируют” чип для конкретного пользователя
  matchesUserInterests: (interests: NonNullable<Interests>) => boolean

  // Какие `vacationTypes` и `placeTypes` мы подставим в алгоритм маршрута,
  // если пользователь выбрал этот чип.
  toInterestsHints: (interests: NonNullable<Interests>) => Pick<Interests, 'vacationTypes' | 'placeTypes'>
}

function hasAny<T extends string>(arr: T[] | undefined, ids: T[]) {
  if (!arr?.length) return false
  return ids.some((id) => arr.includes(id))
}

export const TAG_CHIPS: TagChip[] = [
  {
    id: 'wine',
    label: 'Вино',
    matchesLocation: (loc) => loc.vacationTypes.includes('wine') || loc.placeTypes.includes('wineries'),
    matchesUserInterests: (i) => hasAny(i.vacationTypes, ['wine']) || hasAny(i.placeTypes, ['wineries']),
    toInterestsHints: (i) => ({
      vacationTypes: i.vacationTypes.includes('wine') ? ['wine'] : [],
      placeTypes: i.placeTypes.includes('wineries') ? ['wineries'] : [],
    }),
  },
  {
    id: 'gastro',
    label: 'Гастро',
    matchesLocation: (loc) => loc.vacationTypes.includes('gastro'),
    matchesUserInterests: (i) => hasAny(i.vacationTypes, ['gastro']),
    toInterestsHints: (i) => ({
      vacationTypes: i.vacationTypes.includes('gastro') ? ['gastro'] : [],
      placeTypes: [],
    }),
  },
  {
    id: 'agro',
    label: 'Агро',
    matchesLocation: (loc) => loc.placeTypes.includes('cheese_farms') || loc.placeTypes.includes('eco_farms'),
    matchesUserInterests: (i) => hasAny(i.placeTypes, ['cheese_farms', 'eco_farms']),
    toInterestsHints: (i) => ({
      vacationTypes: [],
      placeTypes: i.placeTypes.includes('cheese_farms') ? ['cheese_farms'] : i.placeTypes.includes('eco_farms') ? ['eco_farms'] : [],
    }),
  },
  {
    id: 'eco',
    label: 'Эко',
    matchesLocation: (loc) => loc.placeTypes.includes('eco_farms') || loc.vacationTypes.includes('nature'),
    matchesUserInterests: (i) => hasAny(i.placeTypes, ['eco_farms']) || hasAny(i.vacationTypes, ['nature']),
    toInterestsHints: (i) => ({
      vacationTypes: i.vacationTypes.includes('nature') ? ['nature'] : [],
      placeTypes: i.placeTypes.includes('eco_farms') ? ['eco_farms'] : [],
    }),
  },
  {
    id: 'trekking',
    label: 'Трекинг',
    matchesLocation: (loc) => loc.placeTypes.includes('trekking_routes') || loc.vacationTypes.includes('active') || loc.vacationTypes.includes('mountains'),
    matchesUserInterests: (i) => hasAny(i.placeTypes, ['trekking_routes']) || hasAny(i.vacationTypes, ['active', 'mountains']),
    toInterestsHints: (i) => ({
      vacationTypes: [
        ...(i.vacationTypes.includes('active') ? (['active'] as const) : []),
        ...(i.vacationTypes.includes('mountains') ? (['mountains'] as const) : []),
      ],
      placeTypes: i.placeTypes.includes('trekking_routes') ? (['trekking_routes'] as const) : [],
    }),
  },
  {
    id: 'festivals',
    label: 'Фестивали',
    matchesLocation: (loc) => loc.placeTypes.includes('festivals'),
    matchesUserInterests: (i) => hasAny(i.placeTypes, ['festivals']),
    toInterestsHints: (i) => ({
      vacationTypes: [],
      placeTypes: i.placeTypes.includes('festivals') ? ['festivals'] : [],
    }),
  },
  {
    id: 'wellness',
    label: 'Оздоровление',
    matchesLocation: (loc) => loc.vacationTypes.includes('wellness'),
    matchesUserInterests: (i) => hasAny(i.vacationTypes, ['wellness']),
    toInterestsHints: (i) => ({
      vacationTypes: i.vacationTypes.includes('wellness') ? ['wellness'] : [],
      placeTypes: [],
    }),
  },
  {
    id: 'culture',
    label: 'Культура',
    matchesLocation: (loc) => loc.vacationTypes.includes('culture') || loc.placeTypes.includes('cossack_stations'),
    matchesUserInterests: (i) => hasAny(i.vacationTypes, ['culture']) || hasAny(i.placeTypes, ['cossack_stations']),
    toInterestsHints: (i) => ({
      vacationTypes: i.vacationTypes.includes('culture') ? ['culture'] : [],
      placeTypes: i.placeTypes.includes('cossack_stations') ? ['cossack_stations'] : [],
    }),
  },
  {
    id: 'family',
    label: 'Семейный',
    matchesLocation: (loc) => loc.vacationTypes.includes('family') || loc.suitableFor.includes('family'),
    matchesUserInterests: (i) => hasAny(i.vacationTypes, ['family']),
    toInterestsHints: (i) => ({
      vacationTypes: i.vacationTypes.includes('family') ? ['family'] : [],
      placeTypes: [],
    }),
  },
]

export function getAvailableTagChips(interests: NonNullable<Interests>) {
  // Показываем чипы “из интересов”, чтобы MVP не выглядел перегруженно.
  return TAG_CHIPS.filter((c) => c.matchesUserInterests(interests))
}

export function filterLocationsByTagChips(locations: Location[], selected: TagChipId[]) {
  if (!selected.length) return locations

  // MVP: фильтруем как AND по выбранным чипам.
  // Это делает поведение предсказуемым (“хочу и вино, и трекинг”).
  return locations.filter((loc) => selected.every((id) => TAG_CHIPS.find((c) => c.id === id)?.matchesLocation(loc)))
}

export function getMatchedTagChipIds(location: Location, interests: NonNullable<Interests>) {
  // Показываем только те чипы, которые:
  // 1) реально подходят локации
  // 2) совпадают с интересами пользователя
  return TAG_CHIPS.filter((chip) => chip.matchesLocation(location) && chip.matchesUserInterests(interests)).map((c) => c.id)
}

export function buildInterestsFromTagChips(interests: NonNullable<Interests>, selected: TagChipId[]) {
  if (!selected.length) {
    return interests
  }

  const hints = selected
    .map((id) => TAG_CHIPS.find((c) => c.id === id))
    .filter(Boolean) as TagChip[]

  const vacationTypes = Array.from(
    new Set(hints.flatMap((h) => h.toInterestsHints(interests).vacationTypes).filter(Boolean)),
  )
  const placeTypes = Array.from(new Set(hints.flatMap((h) => h.toInterestsHints(interests).placeTypes).filter(Boolean)))

  return {
    ...interests,
    vacationTypes,
    placeTypes,
  }
}

