// src/data/locations.ts
import type {
  ActivityLevelId,
  PlaceTypeId,
  SeasonId,
  VacationTypeId,
} from '../types'

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

// API ключ для Geoapify
const API_KEY = '4e3793a793924e688abe127ce6b0549e'

// Только поддерживаемые категории Geoapify (из их списка)
const SUPPORTED_CATEGORIES = [
  'leisure.park',
  'catering.restaurant',
  'catering.cafe',
  'catering.bar',
  'building.tourism',
  'building.historic',
  'beach.beach_resort'
];

// Маппинг категорий Geoapify → твои placeTypes
const categoryMapping: Record<string, PlaceTypeId> = {
  'leisure.park': 'reserves',
  'catering.restaurant': 'cheese_farms', // Условно, так как отдельной категории для сыроварен в API нет
  'catering.cafe': 'cheese_farms',
  'catering.bar': 'wineries',
  'building.tourism': 'reserves',
  'building.historic': 'cossack_stations', // Исторические здания можно отнести к культуре/станицам
  'beach.beach_resort': 'reserves',
};

// Загрузка реальных мест из Geoapify
export const fetchRealLocations = async (): Promise<Location[]> => {
  const { minLng, minLat, maxLng, maxLat } = KUBAN_BOUNDS

  const categories = SUPPORTED_CATEGORIES.join(',')

  const url = `https://api.geoapify.com/v2/places?` +
    `categories=${categories}&` +
    `filter=rect:${minLng},${minLat},${maxLng},${maxLat}&` +
    `limit=50&` +
    `apiKey=${API_KEY}`

  try {
    console.log('🌍 Fetching real places from Geoapify...')
    console.log('🔍 URL:', url)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Response error:', errorText)
      throw new Error(`Geoapify API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ Loaded ${data.features?.length || 0} places from Geoapify`)

    if (!data.features || data.features.length === 0) {
      console.warn('⚠️ No places found, using fallback data')
      return getFallbackLocations()
    }

    const locations: Location[] = data.features.map((feature: any, index: number) => {
      const props = feature.properties
      const [lng, lat] = feature.geometry.coordinates

      const placeTypes: PlaceTypeId[] = props.categories
        ?.map((cat: string) => {
          if (categoryMapping[cat]) return categoryMapping[cat]
          if (cat.includes('park') || cat.includes('reserve')) return 'reserves'
          if (cat.includes('restaurant') || cat.includes('cafe')) return 'cheese_farms'
          if (cat.includes('bar')) return 'wineries'
          if (cat.includes('beach')) return 'reserves'
          return null
        })
        .filter(Boolean) || ['reserves']

      const uniquePlaceTypes = [...new Set(placeTypes)]

      const vacationTypes: VacationTypeId[] = []
      if (uniquePlaceTypes.includes('wineries')) vacationTypes.push('wine', 'gastro')
      if (uniquePlaceTypes.includes('trekking_routes')) vacationTypes.push('active', 'mountains')
      if (uniquePlaceTypes.includes('reserves')) vacationTypes.push('nature', 'wellness')
      if (uniquePlaceTypes.includes('cheese_farms')) vacationTypes.push('gastro', 'family')
      
      if (vacationTypes.length === 0) {
        vacationTypes.push('nature', 'culture')
      }

      let activity: 'low' | 'medium' | 'high' = 'medium'
      if (uniquePlaceTypes.includes('trekking_routes')) activity = 'high'
      if (uniquePlaceTypes.includes('wineries') || uniquePlaceTypes.includes('cheese_farms')) activity = 'low'

      let suitableFor: Array<'family' | 'elder' | 'freelancers' | 'friends' | 'couple'> = ['family', 'couple']
      if (uniquePlaceTypes.includes('trekking_routes')) {
        suitableFor = ['friends', 'couple']
      } else if (uniquePlaceTypes.includes('wineries') || uniquePlaceTypes.includes('cheese_farms')) {
        suitableFor = ['family', 'couple', 'friends', 'elder']
      }

      return {
        id: props.place_id || `geo-${index}`,
        name: props.name || props.address_line1?.split(',')[0] || 'Без названия',
        placeTypes: uniquePlaceTypes,
        vacationTypes: [...new Set(vacationTypes)] as VacationTypeId[],
        seasons: ['spring', 'summer', 'autumn'],
        activity,
        description: props.description || 
                     props.address_line1 || 
                     `Интересное место в Краснодарском крае: ${props.name || 'локация'}`,
        photoUrl: `https://source.unsplash.com/featured/900x600?${encodeURIComponent(
          props.name || 'kuban nature'
        )}`,
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
        prices: uniquePlaceTypes.includes('wineries') ? 'от 1000 ₽ (дегустация)' : 
                uniquePlaceTypes.includes('trekking_routes') ? 'бесплатно / по программе' : 
                uniquePlaceTypes.includes('cheese_farms') ? 'от 500 ₽ (дегустация)' :
                'уточняйте',
      }
    })

    console.log(`🎉 Successfully processed ${locations.length} locations`)
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