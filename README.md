# Transit & Tour Master

REST API для генерации туристических маршрутов. Поиск отелей и достопримечательностей через 2ГИС, оптимизация маршрута (TSP), построение автомобильных и общественных маршрутов, геокодирование через Яндекс.

## Стек

- **Python 3.12** / **FastAPI** / **uvicorn**
- **MongoDB** (Motor — асинхронный драйвер)
- **2ГИС API** — каталог, роутинг, общественный транспорт
- **Яндекс Геокодер** / **Яндекс Расписания**

## Быстрый старт

### Локально

```bash
pip install -r requirements.txt
python server.py
```

### Docker

```bash
./start.sh    # сборка + запуск
./stop.sh     # остановка + удаление
```

Или вручную:

```bash
docker build -t travel-generator .
docker run -d -p 8000:8000 --env-file .env --name travel-generator travel-generator
```

## Переменные окружения (.env)

| Переменная | Описание |
|---|---|
| `YANDEX_GEOCODER_API_KEY` | Ключ Яндекс Геокодера |
| `YANDEX_RASP_API_KEY` | Ключ Яндекс Расписаний |
| `DGis_API_KEY` | Ключ 2ГИС API |
| `MONGO_URI` | URI подключения к MongoDB |

## API Endpoints

Документация доступна по адресу: `http://localhost:8000/docs`

### Healthcheck

| Метод | URL | Описание |
|---|---|---|
| GET | `/healthcheck` | Проверка работоспособности сервиса |

### Прокси

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/chat` | Чат (streaming) |
| GET | `/api/get-panorama` | Панорама по координатам |
| GET | `/panorama-image/{file_id}` | Изображение панорамы |

### Туры

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/v1/search-places` | Поиск отеля и мест рядом |
| POST | `/api/v1/build-tour` | Построить оптимальный маршрут |

### Вебхуки и транспорт

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/receive_tour_data` | Получить данные тура (вебхук) |
| GET | `/api/routes` | Маршруты между точками |

## Структура проекта

```
├── server.py          # FastAPI приложение, все роуты
├── database.py        # Подключение к MongoDB (Motor)
├── gisapi.py          # 2ГИС + Яндекс API сервисы
├── loader.py          # Конфигурация и .env
├── requirements.txt   # Python-зависимости
├── Dockerfile         # Docker-образ
├── start.sh           # Скрипт запуска
├── stop.sh            # Скрипт остановки
└── .env               # Переменные окружения (не в git)
```
