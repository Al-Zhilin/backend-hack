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

  // --- MVP хакатона: “визитка места” ---
  // Фото-галерея (5–8 шт). Если поле не заполнено — UI покажет `photoUrl` как fallback.
  photos?: string[]
  // Адрес / как добраться
  address?: string
  howToGet?: string

  // Публичные метаданные для VR/360
  vr_enabled?: boolean
  // URL на equirectangular 360 фото (для react-three-fiber sphere texture)
  '360_photo_url'?: string
  // URL на YouTube 360 (embed)
  youtube360_url?: string

  // Поля для карточки на /place/:id (можно заполнять шаблонами/LLM позже)
  workingHours?: string
  contacts?: { phone?: string; site?: string; email?: string }
  prices?: string
  seasonality?: string[]
  recommendations?: string[]
  // Полное AI-описание (для MVP можно сформировать на лету или хранить как строку)
  aiFullDescription?: string
}

// Приблизительные границы Краснодарского края (для проекции lat/lng на плоскость карты)
export const KUBAN_BOUNDS = {
  minLat: 42.2,
  maxLat: 46.7,
  minLng: 35.8,
  maxLng: 41.8,
}

// MVP: 18 локаций (можно расширять позже)
// Мы храним “базовые” данные, а затем (ниже) обогащаем их для требований хакатона:
// фото-галерею, 360/VR метаданные, поля визитки.
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
  {
    id: 'fanagoria',
    name: 'Фанагория',
    placeTypes: ['wineries', 'festivals'],
    vacationTypes: ['wine', 'gastro', 'culture'],
    seasons: ['summer', 'autumn'],
    activity: 'low',
    description: 'История вина и музейные экспозиции + современная дегустационная культура.',
    photoUrl: 'https://placehold.co/900x600/png?text=Фанагория',
    lat: 45.125,
    lng: 37.063,
    suitableFor: ['elder', 'friends', 'couple'],
  },
  {
    id: 'simory',
    name: 'SIMORY',
    placeTypes: ['wineries'],
    vacationTypes: ['wine', 'gastro', 'culture', 'family'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'low',
    description: 'Интерактивные туры и дегустации в современном формате.',
    photoUrl: 'https://placehold.co/900x600/png?text=SIMORY',
    lat: 45.004,
    lng: 37.309,
    suitableFor: ['friends', 'couple', 'family'],
  },

  {
    id: 'ataman-ethno',
    name: 'Атамань (этнокомплекс)',
    placeTypes: ['cossack_stations', 'festivals'],
    vacationTypes: ['culture', 'family', 'gastro'],
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    activity: 'low',
    description: 'Казачий уклад, представления и локальная гастрономия.',
    photoUrl: 'https://placehold.co/900x600/png?text=Атамань',
    lat: 45.229,
    lng: 37.283,
    suitableFor: ['family', 'elder', 'friends'],
  },
  {
    id: 'cossack-hut',
    name: 'Казачий хутор “Традиции”',
    placeTypes: ['cossack_stations'],
    vacationTypes: ['culture', 'family', 'nature', 'gastro'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'low',
    description: 'Прогулки по подворьям, мастер-классы и разговоры о ремеслах.',
    photoUrl: 'https://placehold.co/900x600/png?text=Казачий+хутор',
    lat: 45.020,
    lng: 38.022,
    suitableFor: ['family', 'elder', 'couple'],
  },

  {
    id: 'adygea-cheese',
    name: 'Адыгейская сыроварня',
    placeTypes: ['cheese_farms'],
    vacationTypes: ['gastro', 'nature', 'family'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'low',
    description: 'Экскурсия по ферментации и дегустации местных сыров.',
    photoUrl: 'https://placehold.co/900x600/png?text=Адыгейская+сыроварня',
    lat: 44.889,
    lng: 40.103,
    suitableFor: ['family', 'friends', 'couple'],
  },
  {
    id: 'eco-milk-farm',
    name: 'Эко-ферма “Молоко и травы”',
    placeTypes: ['eco_farms', 'cheese_farms'],
    vacationTypes: ['family', 'nature', 'gastro'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'low',
    description: 'Животные, фермерские маршруты и домашняя продукция.',
    photoUrl: 'https://placehold.co/900x600/png?text=Эко-ферма',
    lat: 44.930,
    lng: 40.287,
    suitableFor: ['family', 'elder'],
  },
  {
    id: 'lotus-valley',
    name: 'Долина лотосов',
    placeTypes: ['reserves'],
    vacationTypes: ['nature', 'nature', 'family'],
    seasons: ['summer', 'autumn'],
    activity: 'low',
    description: 'Сезон цветения, тихие прогулки и фотографические маршруты.',
    photoUrl: 'https://placehold.co/900x600/png?text=Долина+лотосов',
    lat: 45.395,
    lng: 37.314,
    suitableFor: ['family', 'elder', 'couple'],
  },
  {
    id: 'utirish',
    name: 'Большой Утриш',
    placeTypes: ['reserves'],
    vacationTypes: ['sea', 'nature', 'wellness', 'culture'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'medium',
    description: 'Заповедная прибрежная зона: морской воздух, тропы и панорамы.',
    photoUrl: 'https://placehold.co/900x600/png?text=Большой+Утриш',
    lat: 44.770,
    lng: 37.506,
    suitableFor: ['friends', 'couple'],
  },
  {
    id: 'guamka-gorge',
    name: 'Гуамское ущелье',
    placeTypes: ['trekking_routes', 'reserves'],
    vacationTypes: ['mountains', 'active', 'nature', 'family'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'high',
    description: 'Ущелье с тропами и видом на скальные стены. Хорошо для активных походов.',
    photoUrl: 'https://placehold.co/900x600/png?text=Гуамское+ущелье',
    lat: 44.108,
    lng: 39.822,
    suitableFor: ['friends'],
  },
  {
    id: 'mezmay',
    name: 'Мезмай (эко-треки)',
    placeTypes: ['trekking_routes', 'reserves'],
    vacationTypes: ['mountains', 'nature', 'active', 'family'],
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    activity: 'high',
    description: 'Лесные тропы, обзорные точки и атмосферные прогулки в горах.',
    photoUrl: 'https://placehold.co/900x600/png?text=Мезмай',
    lat: 44.4,
    lng: 39.98,
    suitableFor: ['friends', 'family'],
  },
  {
    id: 'tea-plantations',
    name: 'Чайные плантации (Сочи)',
    placeTypes: ['reserves'],
    vacationTypes: ['wellness', 'nature', 'culture'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'medium',
    description: 'Пешеходные маршруты между чайными террасами и дегустация напитков.',
    photoUrl: 'https://placehold.co/900x600/png?text=Чайные+плантации',
    lat: 43.58,
    lng: 39.72,
    suitableFor: ['elder', 'couple', 'freelancers'],
  },
  {
    id: 'kavkaz-biosphere',
    name: 'Кавказский биосферный заповедник',
    placeTypes: ['reserves'],
    vacationTypes: ['nature', 'active', 'wellness'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'high',
    description: 'Эко-треки и наблюдение за природой в рамках заповедного маршрута.',
    photoUrl: 'https://placehold.co/900x600/png?text=Заповедник',
    lat: 43.47,
    lng: 40.08,
    suitableFor: ['friends', 'elder', 'freelancers'],
  },
  {
    id: 'festival-tampani',
    name: 'Фестиваль урожая в Тамани',
    placeTypes: ['festivals', 'cossack_stations'],
    vacationTypes: ['gastro', 'culture', 'family'],
    seasons: ['autumn'],
    activity: 'low',
    description: 'Традиции, вкусные локации и праздничные события у моря.',
    photoUrl: 'https://placehold.co/900x600/png?text=Фестиваль+урожая',
    lat: 45.183,
    lng: 36.8,
    suitableFor: ['family', 'friends', 'couple', 'elder'],
  },

  {
    id: 'eco-forest-farm',
    name: 'Эко-ферма “Лесной круг”',
    placeTypes: ['eco_farms', 'cheese_farms'],
    vacationTypes: ['nature', 'gastro', 'family'],
    seasons: ['spring', 'summer', 'autumn'],
    activity: 'low',
    description: 'Контакт с животными, свежие продукты и короткие семейные маршруты.',
    photoUrl: 'https://placehold.co/900x600/png?text=Лесной+круг',
    lat: 44.95,
    lng: 40.35,
    suitableFor: ['family', 'elder'],
  },
  {
    id: 'farmers-market',
    name: 'Локальная гастро-точка “Вкус Кубани”',
    placeTypes: ['festivals', 'cheese_farms'],
    vacationTypes: ['gastro', 'culture', 'family'],
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    activity: 'low',
    description: 'Гастрономический формат: сыр, вино, локальные блюда и дегустации.',
    photoUrl: 'https://placehold.co/900x600/png?text=Вкус+Кубани',
    lat: 45.03,
    lng: 38.97,
    suitableFor: ['freelancers', 'friends', 'couple', 'family'],
  },
  {
    id: 'casual-vineyard-day',
    name: 'Виноградники у моря (дегустационный маршрут)',
    placeTypes: ['wineries'],
    vacationTypes: ['wine', 'sea', 'gastro'],
    seasons: ['summer', 'autumn'],
    activity: 'low',
    description: 'Мягкий день: море + дегустация. Хорошо для первого знакомства с регионом.',
    photoUrl: 'https://placehold.co/900x600/png?text=Виноградники+у+моря',
    lat: 44.87,
    lng: 37.31,
    suitableFor: ['couple', 'elder', 'friends'],
  },
]

function makeUnsplashFeaturedPhotos(query: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    // `source.unsplash.com` отдаёт случайные, но реальные изображения из Unsplash.
    // `sig` помогает получать разные картинки в рамках одного списка.
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
    'Построим маршрут так, чтобы было достаточно времени на дегустации, прогулки и “мягкую” адаптацию к темпу семьи.'
  )
}

function enrichLocation(loc: Location): Location {
  // 1) Фото-галерея (5–8)
  // MVP: выбираем набор по “типу” локации.
  let primaryQuery = 'nature'
  if (loc.placeTypes.includes('wineries')) primaryQuery = 'wine'
  else if (loc.placeTypes.includes('festivals')) primaryQuery = 'festival'
  else if (loc.placeTypes.includes('cheese_farms') || loc.placeTypes.includes('eco_farms')) primaryQuery = 'farm'
  else if (loc.placeTypes.includes('trekking_routes')) primaryQuery = 'mountains'
  else if (loc.placeTypes.includes('cossack_stations')) primaryQuery = 'culture'
  else if (loc.placeTypes.includes('reserves')) primaryQuery = 'nature'

  const photos = loc.photos?.length ? loc.photos : makeUnsplashFeaturedPhotos(primaryQuery, 7)

  // 2) Адрес / как добраться / сервис
  const address = loc.address ?? `Краснодарский край, ${loc.name} (точный адрес уточняется)`
  const howToGet = loc.howToGet ?? 'Отталкиваемся от вашего маршрута: короткая логистика + удобная посадка.'

  const vrEnabledIds = new Set(['tamani-chateau', 'lefkadia-valley', 'lotus-valley', 'guamka-gorge'])
  const vr_enabled = typeof loc.vr_enabled === 'boolean' ? loc.vr_enabled : vrEnabledIds.has(loc.id)

  // 360/VR: Poly Haven даёт equirectangular HDRI/tonemapped JPG, подходящие для текстуры сферы.
  const vr360ById: Record<string, string> = {
    'tamani-chateau':
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/pathway_morning.jpg',
    'lefkadia-valley':
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/golden_bay.jpg',
    'lotus-valley':
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/flamingo_pan.jpg',
    'guamka-gorge':
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/rooftop_day.jpg',
  }

  const photo360Url = loc['360_photo_url'] ?? (vr_enabled ? vr360ById[loc.id] : undefined)

  const youtube360ById: Record<string, string> = {
    'tamani-chateau': 'https://www.youtube.com/embed/rqnf5veV8P4',
    'lefkadia-valley': 'https://www.youtube.com/embed/rqnf5veV8P4',
    'lotus-valley': 'https://www.youtube.com/embed/rqnf5veV8P4',
    'guamka-gorge': 'https://www.youtube.com/embed/rqnf5veV8P4',
  }

  const youtube360_url = loc.youtube360_url ?? (vr_enabled ? youtube360ById[loc.id] : undefined)

  const workingHours = loc.workingHours ?? 'Ежедневно 10:00–20:00'
  const contacts = loc.contacts ?? { phone: '+7 (900) 123-45-67', site: 'kuban-smotry.example' }

  let prices = loc.prices
  if (!prices) {
    if (loc.placeTypes.includes('wineries')) prices = 'от 2 500 ₽ / взрослый (дегустации по программе)'
    else if (loc.placeTypes.includes('trekking_routes')) prices = 'от 1 800 ₽ / взрослый (тропа + маршрут)'
    else prices = 'от 1 200 ₽ / взрослый (вход + активности по формату)'
  }

  const seasonality = loc.seasonality ?? loc.seasons
  const recommendations =
    loc.recommendations ?? [
      'Если едете с детьми — закладывайте 20–30 минут “на адаптацию” в начале дня.',
      'Лучшее время для фото — раннее утро или ближе к закату.',
      'Не перегружайте маршрут: лучше 2 “якорные” точки и 1 спокойную прогулку.',
    ]

  return {
    ...loc,
    photos,
    address,
    howToGet,
    vr_enabled,
    '360_photo_url': photo360Url,
    youtube360_url,
    workingHours,
    contacts,
    prices,
    seasonality,
    recommendations,
    aiFullDescription: loc.aiFullDescription ?? makeDefaultAIText(loc),
  }
}

export const LOCATIONS = BASE_LOCATIONS.map(enrichLocation)

