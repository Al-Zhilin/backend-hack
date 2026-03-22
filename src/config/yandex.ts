export const YANDEX_MAPS_API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY as string

export const YANDEX_MAPS_QUERY = {
  apikey: YANDEX_MAPS_API_KEY,
  lang: 'ru_RU',
  load: 'package.full',
} as const
