// src/data/locations.ts
import type {
  ActivityLevelId,
  PlaceTypeId,
  SeasonId,
  VacationTypeId,
} from '../types'
import {
  GEOAPIFY_CATEGORY_BATCHES,
  geoCategoryToPlaceTypes,
  categoriesFromFeatureProperties,
} from './geoapifyPlaceMapping'

export interface Location {
  id: string
  name: string
  placeTypes: PlaceTypeId[]
  vacationTypes: VacationTypeId[]
  seasons: SeasonId[]
  activity: ActivityLevelId
  description: string
  photoUrl: string
  lat: number
  lng: number
  suitableFor: Array<'family' | 'elder' | 'freelancers' | 'friends' | 'couple'>

  photos?: string[]
  address?: string
  howToGet?: string
  vr_enabled?: boolean
  '360_photo_url'?: string
  youtube360_url?: string
  workingHours?: string
  contacts?: { phone?: string; site?: string; email?: string }
  prices?: string
  seasonality?: string[]
  recommendations?: string[]
  aiFullDescription?: string
}

// Приблизительные границы Краснодарского края
export const KUBAN_BOUNDS = {
  minLat: 43.2,
  maxLat: 46.7,
  minLng: 36.5,
  maxLng: 41.8,
}

const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string
const GEOAPIFY_V2 = import.meta.env.VITE_GEOAPIFY_BASE_URL_V2 as string

function collectPlaceTypesFromCategories(categories: string[]): PlaceTypeId[] {
  const set = new Set<PlaceTypeId>()
  for (const cat of categories) {
    for (const t of geoCategoryToPlaceTypes(cat)) {
      set.add(t)
    }
  }
  return [...set]
}

function vacationAndMetaForTypes(uniquePlaceTypes: PlaceTypeId[]) {
  const vacationTypes: VacationTypeId[] = []
  if (uniquePlaceTypes.includes('wineries')) vacationTypes.push('wine', 'gastro')
  if (uniquePlaceTypes.includes('cheese_farms')) vacationTypes.push('gastro', 'family')
  if (uniquePlaceTypes.includes('restaurants_cafes')) vacationTypes.push('gastro', 'family')
  if (uniquePlaceTypes.includes('kids_entertainment')) vacationTypes.push('family', 'active')
  if (uniquePlaceTypes.includes('trekking_routes')) vacationTypes.push('active', 'mountains')
  if (uniquePlaceTypes.includes('reserves')) vacationTypes.push('nature', 'wellness')
  if (uniquePlaceTypes.includes('eco_farms')) vacationTypes.push('nature', 'gastro', 'family')
  if (uniquePlaceTypes.includes('guest_houses')) vacationTypes.push('wellness', 'nature', 'family')
  if (uniquePlaceTypes.includes('cultural_sites') || uniquePlaceTypes.includes('cossack_stations'))
    vacationTypes.push('culture')
  if (uniquePlaceTypes.includes('festivals')) vacationTypes.push('culture', 'family')

  if (vacationTypes.length === 0) vacationTypes.push('nature', 'culture')

  let activity: 'low' | 'medium' | 'high' = 'medium'
  if (uniquePlaceTypes.includes('trekking_routes')) activity = 'high'
  if (uniquePlaceTypes.includes('kids_entertainment')) activity = 'medium'
  if (
    uniquePlaceTypes.includes('wineries') ||
    uniquePlaceTypes.includes('cheese_farms') ||
    uniquePlaceTypes.includes('restaurants_cafes') ||
    uniquePlaceTypes.includes('guest_houses')
  )
    activity = 'low'

  let suitableFor: Array<'family' | 'elder' | 'freelancers' | 'friends' | 'couple'> = ['family', 'couple']
  if (uniquePlaceTypes.includes('trekking_routes')) suitableFor = ['friends', 'couple']
  else if (uniquePlaceTypes.includes('kids_entertainment')) suitableFor = ['family', 'couple', 'friends']
  else if (uniquePlaceTypes.includes('wineries') || uniquePlaceTypes.includes('cheese_farms'))
    suitableFor = ['family', 'couple', 'friends', 'elder']
  else if (uniquePlaceTypes.includes('cultural_sites')) suitableFor = ['family', 'elder', 'couple', 'friends']

  return {
    vacationTypes: [...new Set(vacationTypes)] as VacationTypeId[],
    activity,
    suitableFor,
  }
}

async function fetchGeoapifyBatch(categories: string[]): Promise<any[]> {
  const { minLng, minLat, maxLng, maxLat } = KUBAN_BOUNDS
  const catParam = categories.join(',')
  const url =
    `${GEOAPIFY_V2}/places?` +
    `categories=${catParam}&` +
    `filter=rect:${minLng},${minLat},${maxLng},${maxLat}&` +
    `limit=100&` +
    `apiKey=${API_KEY}`

  const response = await fetch(url)
  if (!response.ok) {
    const err = await response.text()
    console.warn('Geoapify batch failed:', categories[0], response.status, err.slice(0, 200))
    return []
  }
  const data = await response.json()
  return data.features || []
}

/** Несколько запросов по группам категорий → объединение без дубликатов */
export const fetchRealLocations = async (): Promise<Location[]> => {
  try {
    console.log('🌍 Fetching Kuban places from Geoapify (multi-category)...')

    const batchResults = await Promise.all(GEOAPIFY_CATEGORY_BATCHES.map((batch) => fetchGeoapifyBatch(batch)))
    const seen = new Set<string>()
    const features: any[] = []

    for (const list of batchResults) {
      for (const feature of list) {
        const props = feature.properties
        const id = props.place_id || props.placeId || props.id
        const key = id ? String(id) : `${feature.geometry?.coordinates?.join(',')}`
        if (seen.has(key)) continue
        seen.add(key)
        features.push(feature)
      }
    }

    console.log(`✅ Geoapify: уникальных точек после слияния: ${features.length}`)

    if (!features.length) {
      console.warn('⚠️ Нет точек, fallback')
      return getFallbackLocations()
    }

    const locations: Location[] = features.map((feature: any, index: number) => {
      const props = feature.properties
      const [lng, lat] = feature.geometry.coordinates

      const rawCats = categoriesFromFeatureProperties(props)
      const placeTypes = collectPlaceTypesFromCategories(rawCats.length ? rawCats : ['leisure.park'])
      const uniquePlaceTypes = placeTypes.length ? [...new Set(placeTypes)] : (['reserves'] as PlaceTypeId[])

      const { vacationTypes, activity, suitableFor } = vacationAndMetaForTypes(uniquePlaceTypes)

      const priceHint = () => {
        if (uniquePlaceTypes.includes('wineries')) return 'от 1000 ₽ (дегустация)'
        if (uniquePlaceTypes.includes('trekking_routes')) return 'бесплатно / по программе'
        if (uniquePlaceTypes.includes('cheese_farms')) return 'от 500 ₽'
        if (uniquePlaceTypes.includes('restaurants_cafes')) return 'средний чек уточняйте'
        if (uniquePlaceTypes.includes('kids_entertainment')) return 'от 500 ₽'
        if (uniquePlaceTypes.includes('guest_houses')) return 'от 3000 ₽ / сутки'
        return 'уточняйте'
      }

      return {
        id: props.place_id || props.placeId || `geo-${index}`,
        name: props.name || props.address_line1?.split(',')[0] || 'Без названия',
        placeTypes: uniquePlaceTypes,
        vacationTypes,
        seasons: ['spring', 'summer', 'autumn', 'winter'],
        activity,
        description:
          props.description ||
          props.address_line1 ||
          `Интересное место в Краснодарском крае: ${props.name || 'локация'}`,
        photoUrl: `https://source.unsplash.com/featured/900x600?${encodeURIComponent(props.name || 'kuban nature')}`,
        lat,
        lng,
        suitableFor,
        address: props.address_line1 || props.formatted || 'Краснодарский край',
        howToGet: 'Маршрут строится по реальным дорогам через Routing API',
        workingHours: props.opening_hours || 'Уточняйте перед посещением',
        contacts: {
          phone: props.contact?.phone,
          site: props.website || props.datasource?.raw?.website,
        },
        prices: priceHint(),
      }
    })

    return locations
  } catch (error) {
    console.error('❌ Error fetching real locations:', error)
    return getFallbackLocations()
  }
}

// Фолбэк-данные на случай ошибки API
function getFallbackLocations(): Location[] {
  console.log('📦 Using fallback locations')
  return [
    {
      id: 'fallback-1',
      name: 'Долина Лефкадия',
      placeTypes: ['wineries'],
      vacationTypes: ['wine', 'gastro', 'nature'],
      seasons: ['spring', 'summer', 'autumn'],
      activity: 'low',
      description: 'Винодельня с дегустационными залами и видами на холмы',
      photoUrl: 'https://source.unsplash.com/featured/900x600?wine',
      lat: 44.82,
      lng: 37.192,
      suitableFor: ['family', 'couple', 'friends'],
      address: 'Краснодарский край, окрестности Анапы',
      howToGet: 'На автомобиле по трассе М4',
      workingHours: '10:00 - 20:00',
      contacts: { phone: '+7 (861) 123-45-67', site: 'lefkadia.ru' },
      prices: 'от 1500 ₽',
    },
    {
      id: 'fallback-2',
      name: 'Гуамское ущелье',
      placeTypes: ['trekking_routes', 'reserves'],
      vacationTypes: ['mountains', 'active', 'nature'],
      seasons: ['spring', 'summer', 'autumn'],
      activity: 'high',
      description: 'Живописное ущелье с тропами и скальными стенами',
      photoUrl: 'https://source.unsplash.com/featured/900x600?mountains',
      lat: 44.108,
      lng: 39.822,
      suitableFor: ['friends', 'couple'],
      address: 'Апшеронский район, п. Гуамка',
      howToGet: 'На автомобиле до поселка Гуамка',
      workingHours: 'Круглосуточно',
      contacts: {},
      prices: 'бесплатно',
    },
    {
      id: 'fallback-3',
      name: 'Шато Тамань',
      placeTypes: ['wineries'],
      vacationTypes: ['wine', 'gastro'],
      seasons: ['spring', 'summer', 'autumn'],
      activity: 'low',
      description: 'Винодельня на Таманском полуострове',
      photoUrl: 'https://source.unsplash.com/featured/900x600?vineyard',
      lat: 45.183,
      lng: 36.799,
      suitableFor: ['family', 'couple'],
      address: 'Таманский полуостров',
      howToGet: 'На автомобиле',
      workingHours: '10:00 - 19:00',
      contacts: {},
      prices: 'от 2000 ₽',
    },
    {
      id: 'fallback-4',
      name: 'Большой Утриш',
      placeTypes: ['reserves'],
      vacationTypes: ['sea', 'nature', 'wellness'],
      seasons: ['spring', 'summer', 'autumn'],
      activity: 'medium',
      description: 'Заповедная прибрежная зона',
      photoUrl: 'https://source.unsplash.com/featured/900x600?beach',
      lat: 44.77,
      lng: 37.506,
      suitableFor: ['friends', 'couple'],
      address: 'Анапский район',
      howToGet: 'На автомобиле',
      workingHours: 'Круглосуточно',
      contacts: {},
      prices: 'бесплатно',
    },
  ]
}

// ========== СТАТИЧНЫЕ ДАННЫЕ (18 локаций для MVP) ==========
const BASE_LOCATIONS: Location[] = [
  {
    id: 'tamani-chateau',
    name: 'Шато Тамань',
    placeTypes: ['wineries', 'festivals'],
    vacationTypes: ['wine', 'gastro', 'culture', 'family'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'low',
    description: 'Дегустации вин, прогулки по виноградникам и атмосферные экскурсии у моря.',
    photoUrl: 'https://placehold.co/900x600/png?text=Шато+Тамань',
    lat: 45.183,
    lng: 36.799,
    suitableFor: ['family', 'elder', 'couple', 'friends'],
  },
  {
    id: 'lefkadia-valley',
    name: 'Долина Лефкадия',
    placeTypes: ['wineries'],
    vacationTypes: ['wine', 'gastro', 'nature', 'culture'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'low',
    description: 'Терруарные прогулки, гастро-встречи и видовые маршруты по холмам.',
    photoUrl: 'https://placehold.co/900x600/png?text=Долина+Лефкадия',
    lat: 44.820,
    lng: 37.192,
    suitableFor: ['couple', 'friends', 'family'],
  },
  // ... добавьте остальные 16 локаций из вашего исходного файла
]

function makeUnsplashFeaturedPhotos(query: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    return `https://source.unsplash.com/featured/900x600?${encodeURIComponent(query)}&sig=${i + 1}`
  })
}

function makeDefaultAIText(loc: Location) {
  const tagHints = [...loc.vacationTypes.slice(0, 2), ...loc.placeTypes.slice(0, 2)]
    .slice(0, 3)
    .filter(Boolean)
    .join(', ')
  return (
    `AI-гид для ${loc.name}: ${loc.description} ` +
    (tagHints ? `Сфокусируемся на впечатлениях под ваши интересы: ${tagHints}. ` : '') +
    'Построим маршрут так, чтобы было достаточно времени на дегустации, прогулки и "мягкую" адаптацию к темпу семьи.'
  )
}

function enrichLocation(loc: Location): Location {
  let primaryQuery = 'nature'
  if (loc.placeTypes.includes('wineries')) primaryQuery = 'wine'
  else if (loc.placeTypes.includes('festivals')) primaryQuery = 'festival'
  else if (loc.placeTypes.includes('cheese_farms') || loc.placeTypes.includes('eco_farms')) primaryQuery = 'farm'
  else if (loc.placeTypes.includes('restaurants_cafes')) primaryQuery = 'food'
  else if (loc.placeTypes.includes('guest_houses')) primaryQuery = 'hotel'
  else if (loc.placeTypes.includes('kids_entertainment')) primaryQuery = 'family'
  else if (loc.placeTypes.includes('cultural_sites')) primaryQuery = 'culture'
  else if (loc.placeTypes.includes('trekking_routes')) primaryQuery = 'mountains'
  else if (loc.placeTypes.includes('cossack_stations')) primaryQuery = 'culture'
  else if (loc.placeTypes.includes('reserves')) primaryQuery = 'nature'

  const photos = loc.photos?.length ? loc.photos : makeUnsplashFeaturedPhotos(primaryQuery, 7)
  const address = loc.address ?? `Краснодарский край, ${loc.name}`
  const howToGet = loc.howToGet ?? 'Отталкиваемся от вашего маршрута'

  const vrEnabledIds = new Set(['tamani-chateau', 'lefkadia-valley', 'lotus-valley', 'guamka-gorge'])
  const vr_enabled = typeof loc.vr_enabled === 'boolean' ? loc.vr_enabled : vrEnabledIds.has(loc.id)

  const workingHours = loc.workingHours ?? 'Ежедневно 10:00–20:00'
  const contacts = loc.contacts ?? { phone: '+7 (900) 123-45-67', site: 'kuban-smotry.example' }

  let prices = loc.prices
  if (!prices) {
    if (loc.placeTypes.includes('wineries')) prices = 'от 2 500 ₽ / взрослый'
    else if (loc.placeTypes.includes('trekking_routes')) prices = 'от 1 800 ₽ / взрослый'
    else prices = 'от 1 200 ₽ / взрослый'
  }

  const seasonality = loc.seasonality ?? loc.seasons
  const recommendations = loc.recommendations ?? [
    'Если едете с детьми — закладывайте 20–30 минут "на адаптацию" в начале дня.',
    'Лучшее время для фото — раннее утро или ближе к закату.',
  ]

  return {
    ...loc,
    photos,
    address,
    howToGet,
    vr_enabled,
    workingHours,
    contacts,
    prices,
    seasonality,
    recommendations,
    aiFullDescription: loc.aiFullDescription ?? makeDefaultAIText(loc),
  }
}

// Экспортируем статичные обогащенные локации
export const LOCATIONS = BASE_LOCATIONS.map(enrichLocation)