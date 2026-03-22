# Кубань.Смотри! (kuban-smotry)

Веб-приложение для персонализированного планирования путешествий по Краснодарскому краю.
Генерирует маршруты с помощью AI, показывает интерактивную карту с реальными точками из Geoapify, предлагает 360°-панорамы и VR-просмотр.

## Возможности

- **Персонализация** — выбор роли (путешественник / партнёр), интересов, сезона, компании, уровня активности
- **Интерактивная карта** — Yandex Maps + Leaflet с реальными маршрутами по дорогам, метками и кластерами
- **AI-генерация туров** — чат с нейросетью: описываете поездку естественным языком, получаете варианты маршрутов
- **Рекомендации** — подбор мест по интересам, сезону и типу отдыха
- **360° / VR** — панорамный просмотр выбранных локаций
- **Профиль и «Мои путешествия»** — сохранение в localStorage

## Технологический стек

| Категория | Технология |
|-----------|------------|
| Фреймворк | React 18 |
| Роутинг | react-router-dom 6 |
| Сборка | Vite 5 |
| Язык | TypeScript 5 |
| Карты | @pbe/react-yandex-maps, Leaflet, react-leaflet |
| 3D / VR | Three.js, @react-three/fiber, @react-three/drei |
| Анимации | Framer Motion |
| Стили | Sass (SCSS) |
| Деплой | Netlify |

## Структура проекта

```
├── public/                   # Статические ресурсы (favicon, иконки)
├── src/
│   ├── main.ts               # Точка входа
│   ├── App.tsx                # Корневой компонент, роутинг
│   ├── types.ts               # Общие TypeScript-типы
│   ├── config/
│   │   └── yandex.ts          # Конфигурация Yandex Maps
│   ├── data/
│   │   ├── index.ts           # Реэкспорт данных
│   │   └── locations.ts       # Локации: загрузка из Geoapify + фолбэк-данные
│   ├── hooks/
│   │   └── useRealLocations.ts # Хук загрузки реальных мест
│   ├── components/
│   │   ├── AuthPage.tsx       # Авторизация и онбординг
│   │   ├── InteractiveMap.tsx # Интерактивная карта (основной экран)
│   │   ├── InterestWizard.tsx # Визард выбора интересов
│   │   ├── RoleChoice.tsx     # Выбор роли
│   │   ├── RouteGenerator.tsx # Обёртка генератора маршрутов
│   │   ├── Map.tsx            # Leaflet-карта
│   │   ├── PlaceSidePanel.tsx # Боковая панель места
│   │   ├── PlaceFullWidthHero.tsx # Hero-блок места
│   │   ├── Profile.tsx        # Компонент профиля
│   │   ├── AtmosphereModal.tsx # Модальное окно атмосферы
│   │   ├── Pano360View.tsx    # 360°-просмотр
│   │   ├── VRView.tsx         # VR-просмотр
│   │   └── generate/
│   │       ├── GeneratePage.tsx  # Страница AI-генерации туров
│   │       ├── ChatInput.tsx     # Поле ввода чата
│   │       ├── TourCards.tsx     # Карточки вариантов туров
│   │       ├── TourMap.tsx       # Карта маршрута тура
│   │       ├── PlaceModal.tsx    # Модальное окно точки тура
│   │       └── types.ts         # Типы генерации
│   ├── pages/
│   │   ├── PlacePage.tsx         # Страница места
│   │   ├── ProfilePage.tsx       # Страница профиля
│   │   ├── RecommendationsPage.tsx # Страница рекомендаций
│   │   └── TripsPage.tsx         # Страница «Мои путешествия»
│   ├── services/
│   │   └── geoapify.ts        # Сервис Geoapify API (маршруты, геокодинг, места)
│   ├── utils/
│   │   ├── mapProjection.ts   # Проекция координат для карты
│   │   ├── panoramaTexture.ts # Текстуры для панорам
│   │   ├── scoring.ts         # Скоринг совпадения мест с интересами
│   │   ├── storage.ts         # Работа с localStorage
│   │   ├── tagChips.ts        # Чипы тегов
│   │   └── userTagMapping.ts  # Маппинг пользовательских тегов
│   ├── styles/                # SCSS-стили
│   └── assets/                # Изображения и SVG
├── .env                       # Переменные окружения (API-ключи, URL сервисов)
├── index.html                 # HTML-шаблон
├── package.json
├── tsconfig.json
├── vite.config.ts
└── netlify.toml               # Конфигурация деплоя на Netlify
```

## Маршруты приложения

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/` | AuthPage | Авторизация и онбординг |
| `/map` | InteractiveMap | Интерактивная карта |
| `/generate` | RouteGenerator / GeneratePage | AI-генерация туров |
| `/trips` | TripsPage | Мои путешествия |
| `/place/:id` | PlacePage | Детальная страница места |
| `/pano` | Pano360View | 360°-панорама |
| `/profile` | ProfilePage | Профиль и интересы |
| `/recommendations` | RecommendationsPage | Рекомендации по сезону |
| `/partner/locations` | — | Локации партнёра (заглушка) |
| `/partner/add` | — | Добавление объекта (заглушка) |
| `/vr` | VRView | VR-просмотр |

## Переменные окружения

Конфигурация хранится в файле `.env` в корне проекта. Vite автоматически подхватывает переменные с префиксом `VITE_` и делает их доступными через `import.meta.env`.

| Переменная | Описание |
|------------|----------|
| `VITE_YANDEX_MAPS_API_KEY` | API-ключ Yandex Maps |
| `VITE_GEOAPIFY_API_KEY` | API-ключ Geoapify |
| `VITE_GEOAPIFY_BASE_URL_V1` | Базовый URL Geoapify API v1 |
| `VITE_GEOAPIFY_BASE_URL_V2` | Базовый URL Geoapify API v2 |
| `VITE_BACKEND_API_URL` | URL бэкенда генерации туров |

## Внешние API

### Yandex Maps
Интерактивная карта с метками, полилиниями, кластерами. Подключается через `@pbe/react-yandex-maps`.

### Geoapify
- **Routing API** — построение маршрутов по дорогам
- **Route Matrix API** — матрица расстояний между точками
- **Geocoding API** — поиск координат по адресу
- **Places API v2** — загрузка реальных мест в границах Краснодарского края

### Backend (генерация туров)
AI-бэкенд на `render.com`. Принимает POST-запрос с `{ prompt: string }`, возвращает массив сгенерированных туров. Клиент последовательно пробует эндпоинты `/`, `/generate`, `/tour`, `/chat`.

## Установка и запуск

```bash
# Клонировать репозиторий
git clone <url>
cd kuban-smotry

# Установить зависимости
npm install

# Запустить dev-сервер
npm run dev

# Собрать production-билд
npm run build

# Предпросмотр билда
npm run preview
```

## Деплой

Проект настроен для деплоя на **Netlify**:
- Команда сборки: `npm run build`
- Директория публикации: `dist`
- SPA-редирект: все пути ведут на `index.html` (status 200)

Конфигурация в `netlify.toml`.
