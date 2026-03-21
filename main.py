import os
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any, Dict

YANDEX_GEOCODER_API_KEY = os.getenv("YANDEX_GEOCODER_API_KEY", "ВАШ_КЛЮЧ_ГЕОКОДЕРА")
YANDEX_RASP_API_KEY = os.getenv("YANDEX_RASP_API_KEY", "ВАШ_КЛЮЧ_РАСПИСАНИЙ")

GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/"
RASP_API_URL = "https://api.rasp.yandex.net/v3.0/search/"

class Segment(BaseModel):
    """Модель одного сегмента пути (например, поезд, автобус)"""
    departure: str
    arrival: str
    start_time: str
    end_time: str
    transport_type: str
    carrier_name: Optional[str] = None

class Route(BaseModel):
    """Модель всего маршрута (может состоять из нескольких сегментов)"""
    total_duration: int  # в минутах
    segments: List[Segment]

class RoutesResponse(BaseModel):
    """Финальная структура ответа"""
    from_address: str
    to_address: str
    routes: List[Route]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # На время тестов разрешаем всем
    allow_methods=["*"],
    allow_headers=["*"],
)

TOURS_DATA = {
  "tours": [
    {
      "id": "tour-1",
      "title": "Активный семейный тур по предгорьям",
      "duration": 3,
      "description": "Трёхдневное путешествие для всей семьи, сочетающее лёгкие пешие прогулки, знакомство с фермерским хозяйством и мастер-классы на свежем воздухе. Идеально для отдыха с детьми от 6 лет.",
      "price": "от 28 000 ₽",
      "points": [
        {
          "id": "p1",
          "name": "Эко-ферма 'Лаванда'",
          "address": "Краснодарский край, Крымский р-н, ст. Варениковская",
          "lat": 44.8923,
          "lng": 37.9124,
          "description": "Ферма с полями лаванды, козья ферма и мастер-класс по сыроделию. Для детей организовано мини-кафе с козьим молоком и домашней выпечкой.",
          "tags": ["агротуризм", "семейный", "гастрономия"]
        },
        {
          "id": "p2",
          "name": "Каньон 'Медовые водопады'",
          "address": "Краснодарский край, Апшеронский р-н, п. Мезмай",
          "lat": 44.1885,
          "lng": 39.9521,
          "description": "Каскад из четырёх водопадов высотой до 18 метров. Обустроенная экотропа с настилами и смотровыми площадками, доступная для прогулок с колясками.",
          "tags": ["природа", "водопады", "экотропа"]
        },
        {
          "id": "p3",
          "name": "Дольмены в урочище 'Чёртово городище'",
          "address": "Краснодарский край, Мостовский р-н, п. Перевалка",
          "lat": 44.2817,
          "lng": 40.2221,
          "description": "Комплекс древних дольменов возрастом более 4000 лет. Интерактивная экскурсия с элементами квеста для детей и рассказом о легендах этих мест.",
          "tags": ["история", "археология", "квест"]
        },
        {
          "id": "p4",
          "name": "Конно-спортивный клуб 'Предгорье'",
          "address": "Краснодарский край, Белореченский р-н, х. Родники",
          "lat": 44.6823,
          "lng": 39.8627,
          "description": "Конные прогулки по предгорьям (маршрут 5 км), катание на пони для самых маленьких, обучение основам ухода за лошадьми.",
          "tags": ["активный", "конный спорт", "дети"]
        },
        {
          "id": "p6",
          "name": "Форелевое хозяйство 'Золотая рыбка'",
          "address": "Краснодарский край, Апшеронский р-н, с. Новые Поляны",
          "lat": 44.2688,
          "lng": 39.8834,
          "description": "Прудовая ферма с кормлением радужной форели. Для гостей организуют пикник с ухой на костре и дегустацией свежей рыбы.",
          "tags": ["гастрономия", "пикник", "аквакультура"]
        }
      ]
    },
    {
      "id": "tour-2",
      "title": "Выходные у моря: отдых с историей",
      "duration": 2,
      "description": "Мини-путешествие на черноморское побережье с посещением античного городища, прогулкой по набережной и дегустацией местных вин.",
      "price": "от 15 500 ₽",
      "points": [
        {
          "id": "p7",
          "name": "Городище 'Горгиппия'",
          "address": "Краснодарский край, г. Анапа, ул. Набережная",
          "lat": 44.8939,
          "lng": 37.3122,
          "description": "Руины древнего города Боспорского царства под открытым небом. Интерактивная экскурсия с дополненной реальностью (AR-очки в прокате).",
          "tags": ["история", "археология", "древности"]
        }
      ]
    }
  ]
}

# --- 3. Вспомогательные функции для работы с API ---
async def get_coordinates(address: str, client: httpx.AsyncClient) -> tuple[float, float]:
    """
    Преобразует текстовый адрес в координаты (широта, долгота) через Яндекс.Геокодер.
    Возвращает кортеж (lat, lon).
    """
    params = {
        "apikey": YANDEX_GEOCODER_API_KEY,
        "geocode": address,
        "format": "json",
        "results": 1  # Нам нужен только самый релевантный результат
    }

    try:
        response = await client.get(GEOCODER_URL, params=params)
        response.raise_for_status()
        data = response.json()

        # Парсим JSON ответ геокодера
        geo_object = data["response"]["GeoObjectCollection"]["featureMember"][0]["GeoObject"]
        pos = geo_object["Point"]["pos"]
        lon, lat = map(float, pos.split())
        return lat, lon

    except (KeyError, IndexError, httpx.HTTPStatusError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Не удалось найти координаты для адреса '{address}'. Ошибка: {str(e)}"
        )


async def find_nearest_city(lat: float, lon: float, client: httpx.AsyncClient) -> str:
    """
    Находит ближайший к координатам населенный пункт (город/станцию) для API Расписаний.
    API Расписаний работает с кодами станций, поэтому нам нужен ближайший транспортный узел.
    """
    # Используем метод /nearest_stations API Расписаний
    params = {
        "apikey": YANDEX_RASP_API_KEY,
        "lat": lat,
        "lng": lon,
        "distance": 50,  # ищем в радиусе 50 км
        "format": "json"
    }

    try:
        response = await client.get("https://api.rasp.yandex.net/v3.0/nearest_stations/", params=params)
        response.raise_for_status()
        data = response.json()

        if data.get("stations") and len(data["stations"]) > 0:
            # Берем самую ближайшую станцию или город
            nearest = data["stations"][0]
            # Возвращаем код станции (например, 's9600213') или название, если кода нет
            return nearest.get("station", {}).get("code") or nearest.get("city", {}).get("code")
        else:
            raise HTTPException(status_code=404, detail="Не найдено транспортных узлов поблизости")

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при поиске ближайшей станции: {str(e)}")


async def search_routes(from_code: str, to_code: str, client: httpx.AsyncClient) -> Dict[str, Any]:
    """
    Ищет маршруты между двумя кодами станций/городов через API Яндекс.Расписаний.
    """
    params = {
        "apikey": YANDEX_RASP_API_KEY,
        "from": from_code,
        "to": to_code,
        "format": "json",
        "transfers": True,  # Разрешаем маршруты с пересадками
        "limit": 5  # Ограничиваем количество вариантов для ответа
    }

    try:
        response = await client.get(RASP_API_URL, params=params)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при поиске маршрутов: {str(e)}")


# --- 4. Основной эндпоинт FastAPI ---
@app.get("/api/routes", response_model=RoutesResponse)
async def get_routes(
        from_place: str = Query(..., description="Название начальной точки (например, 'Москва, Красная площадь')"),
        to_place: str = Query(..., description="Название конечной точки (например, 'Санкт-Петербург, Эрмитаж')"),
):
    """
    Принимает названия двух объектов и возвращает возможные маршруты между ними.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Шаг 1: Получаем координаты для обоих мест
        from_lat, from_lon = await get_coordinates(from_place, client)
        to_lat, to_lon = await get_coordinates(to_place, client)

        # Шаг 2: Находим коды ближайших транспортных узлов (станций/городов)
        from_code = await find_nearest_city(from_lat, from_lon, client)
        to_code = await find_nearest_city(to_lat, to_lon, client)

        # Шаг 3: Ищем маршруты между этими узлами
        rasp_data = await search_routes(from_code, to_code, client)

        # Шаг 4: Преобразуем ответ API Расписаний в нашу модель Route
        routes = []
        for segment_group in rasp_data.get("segments", []):
            segments_list = []
            total_duration = 0

            for seg in segment_group:
                # Извлекаем информацию о каждом сегменте пути
                departure = seg.get("departure", "")
                arrival = seg.get("arrival", "")
                start_time = seg.get("departure_time", "")
                end_time = seg.get("arrival_time", "")
                transport_type = seg.get("transport", {}).get("type", "unknown")
                carrier_name = seg.get("carrier", {}).get("title", None)

                segments_list.append(Segment(
                    departure=departure,
                    arrival=arrival,
                    start_time=start_time,
                    end_time=end_time,
                    transport_type=transport_type,
                    carrier_name=carrier_name
                ))

                # Считаем длительность (в минутах)
                if seg.get("duration"):
                    total_duration += int(seg["duration"])

            if segments_list:
                routes.append(Route(total_duration=total_duration, segments=segments_list))

        # Шаг 5: Возвращаем результат
        return RoutesResponse(
            from_address=from_place,
            to_address=to_place,
            routes=routes
        )

@app.post("/")
def root():
    return TOURS_DATA

@app.get("/ping")
def pingochka():
    return {"answer: " : "okey epta!"}