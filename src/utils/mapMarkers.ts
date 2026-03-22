import type { PlaceTypeId } from '../types'
import type { Location } from '../data/locations'

/** Приоритет для выбора «главного» типа при отображении одной иконки */
const MARKER_TYPE_PRIORITY: PlaceTypeId[] = [
  'trekking_routes',
  'kids_entertainment',
  'wineries',
  'cheese_farms',
  'restaurants_cafes',
  'cultural_sites',
  'cossack_stations',
  'reserves',
  'eco_farms',
  'guest_houses',
  'festivals',
]

/**
 * Определяет основной тип места для иконки на карте (если у объекта несколько типов).
 */
export function getPrimaryPlaceTypeForMarker(placeTypes: PlaceTypeId[]): PlaceTypeId {
  if (!placeTypes.length) return 'reserves'
  const found = MARKER_TYPE_PRIORITY.find((t) => placeTypes.includes(t))
  return found ?? placeTypes[0]!
}

/** Цвета меток (Яндекс: preset circleDotIcon + iconColor) */
export const TYPE_MARKER_COLOR: Record<PlaceTypeId, string> = {
  wineries: '#7c3aed',
  cheese_farms: '#ca8a04',
  restaurants_cafes: '#ea580c',
  reserves: '#166534',
  kids_entertainment: '#db2777',
  eco_farms: '#4d7c0f',
  guest_houses: '#2563eb',
  trekking_routes: '#dc2626',
  cultural_sites: '#1e3a8a',
  cossack_stations: '#92400e',
  festivals: '#a16207',
}

/** Подписи для подсказки (hint) на метке */
export const PLACE_TYPE_LABEL_RU: Record<PlaceTypeId, string> = {
  wineries: 'Винодельня',
  cheese_farms: 'Сыроварня',
  restaurants_cafes: 'Ресторан / кафе',
  reserves: 'Парк / заповедник',
  kids_entertainment: 'Детский досуг',
  eco_farms: 'Фермерское хозяйство',
  guest_houses: 'Гостевой дом / отель',
  trekking_routes: 'Треккинг',
  cultural_sites: 'Культура',
  cossack_stations: 'Станица / казачество',
  festivals: 'Фестиваль',
}

/** Легенда карты: порядок строк */
export const MAP_LEGEND_ITEMS: Array<{ type: PlaceTypeId; label: string; color: string }> = (
  Object.keys(TYPE_MARKER_COLOR) as PlaceTypeId[]
).map((type) => ({
  type,
  label: PLACE_TYPE_LABEL_RU[type],
  color: TYPE_MARKER_COLOR[type],
}))

export function getPlacemarkOptionsForLocation(loc: Location) {
  const primary = getPrimaryPlaceTypeForMarker(loc.placeTypes)
  const color = TYPE_MARKER_COLOR[primary] ?? '#64748b'
  const typeLabel = PLACE_TYPE_LABEL_RU[primary] ?? primary
  return {
    options: {
      preset: 'islands#circleDotIcon',
      iconColor: color,
    },
    properties: {
      hintContent: `${loc.name} · ${typeLabel}`,
    },
  }
}

/** Маршрутные метки с номером: цвет по типу места + круг с цифрой */
export function getRoutePlacemarkOptions(loc: Location, routeIndex: number) {
  const primary = getPrimaryPlaceTypeForMarker(loc.placeTypes)
  const color = TYPE_MARKER_COLOR[primary] ?? '#16a34a'

  return {
    options: {
      preset: 'islands#circleIcon',
      iconColor: color,
    },
    properties: {
      iconContent: String(routeIndex + 1),
      hintContent: `${loc.name} · остановка ${routeIndex + 1}`,
    },
  }
}
