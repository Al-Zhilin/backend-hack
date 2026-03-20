export const YANDEX_MAPS_API_KEY = '0052a09e-3633-4c3f-84c1-1c2309b4728b'

// В production лучше вынести ключ в `VITE_YANDEX_MAPS_API_KEY` и читать через `import.meta.env`,
// но для MVP демо оставляем константой.

export const YANDEX_MAPS_QUERY = {
  apikey: YANDEX_MAPS_API_KEY,
  lang: 'ru_RU',
  // Подключаем максимум нужных модулей для полилиний/кластеров/трафика.
  load: 'package.full',
} as const

