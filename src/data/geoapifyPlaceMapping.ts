import type { PlaceTypeId } from '../types'

/**
 * Категории Geoapify Places API (v2), группами — до 100 объектов на запрос.
 * Список: https://apidocs.geoapify.com/docs/places/
 */
/**
 * Группы категорий Geoapify Places API (v2). Полный перечень объектов региона недостижим
 * из‑за лимитов API; здесь максимально широкое покрытие типов для Кубани.
 * @see https://apidocs.geoapify.com/docs/places/
 */
export const GEOAPIFY_CATEGORY_BATCHES: string[][] = [
  [
    'production.winery',
    'production.dairy',
    'catering.restaurant',
    'catering.cafe',
    'catering.bar',
    'catering.fast_food',
  ],
  ['leisure.park', 'natural.forest', 'natural.reserve', 'beach.beach_resort', 'natural.water'],
  ['entertainment', 'tourism.museum', 'tourism.attraction', 'tourism.sights', 'building.historic', 'building.tourism'],
  ['commercial.farm', 'accommodation.hotel', 'accommodation.guest_house', 'accommodation.hostel', 'accommodation.motel'],
  ['sport.hiking', 'leisure.playground', 'sport.ski', 'leisure.spa'],
  ['public.transport', 'service.car_repair', 'tourism.information'],
]

/** Все категории из батчей — для запроса по видимой области карты (одна строка). */
export const GEOAPIFY_FLAT_CATEGORIES_FOR_BOUNDS = [...new Set(GEOAPIFY_CATEGORY_BATCHES.flat())]

const EXACT: Record<string, PlaceTypeId[]> = {
  'production.winery': ['wineries'],
  'production.dairy': ['cheese_farms'],
}

/**
 * Одна строка категории Geoapify → типы мест для карты.
 */
export function geoCategoryToPlaceTypes(category: string): PlaceTypeId[] {
  const c = category.trim().toLowerCase()
  if (EXACT[c]) return [...EXACT[c]!]

  if (c.includes('winery')) return ['wineries']
  if (c.includes('dairy') && c.includes('production')) return ['cheese_farms']

  if (
    c.startsWith('catering.') ||
    c.includes('restaurant') ||
    c.includes('cafe') ||
    (c.includes('bar') && c.startsWith('catering')) ||
    c.includes('fast_food')
  ) {
    return ['restaurants_cafes']
  }

  if (c.includes('hiking') || c.includes('trail') || c.includes('climbing')) return ['trekking_routes']

  if (c.includes('spa') || c.includes('wellness')) return ['reserves']

  if (c.includes('ski')) return ['trekking_routes']

  if (c.includes('playground') || c === 'entertainment' || c.startsWith('entertainment.')) {
    return ['kids_entertainment']
  }

  if (c.includes('farm') && c.includes('commercial')) return ['eco_farms']

  if (c.startsWith('accommodation.') || c.includes('guest_house') || c.includes('hostel')) return ['guest_houses']

  if (
    c.includes('park') ||
    c.includes('reserve') ||
    c.includes('forest') ||
    c.includes('beach') ||
    (c.startsWith('natural.') && !c.includes('reserve'))
  ) {
    if (c.includes('hiking')) return ['trekking_routes']
    return ['reserves']
  }

  if (
    c.includes('museum') ||
    c.includes('historic') ||
    c.includes('monument') ||
    c.includes('attraction') ||
    c.includes('sights') ||
    c.includes('tourism')
  ) {
    return ['cultural_sites']
  }

  if (c.includes('cossack') || c.includes('stanitsa')) return ['cossack_stations']
  if (c.includes('festival')) return ['festivals']

  return ['reserves']
}

export function categoriesFromFeatureProperties(props: { categories?: string[]; category?: string }): string[] {
  if (props.categories?.length) return props.categories
  if (props.category) return [props.category]
  return []
}
