import os
import httpx
import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from dotenv import load_dotenv

load_dotenv()

# API Ключи
YANDEX_GEO_KEY = os.getenv("YANDEX_GEOCODER_API_KEY")
YANDEX_RASP_KEY = os.getenv("YANDEX_RASP_API_KEY")
DGIS_KEY = os.getenv("DGis_API_KEY")
BASE_LOCAL_URL = "https://ratable-convalescently-epifania.ngrok-free.dev"

# Схемы данных (строгие)
class Segment(BaseModel):
    from_title: str
    to_title: str
    departure: Optional[str] = None
    arrival: Optional[str] = None
    type: str
    duration_min: int
    instruction: str


class Route(BaseModel):
    source: str
    total_min: int
    segments: List[Segment]


class RoutesResponse(BaseModel):
    from_address: str
    to_address: str
    routes: List[Route]
    message: Optional[str] = None

class ChatMessage(BaseModel):
    login: str
    text: str

class TourCollectedData(BaseModel):
    login: str
    status: str
    collected_tags: Dict[str, Any]


app = FastAPI(title="Transit Master Final")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.post("/api/chat")
async def proxy_chat(request: Request):
    body = await request.json()

    async def stream_generator():
        async with httpx.AsyncClient() as client:
            async with client.stream(
                    "POST",
                    f"{BASE_LOCAL_URL}/chat",
                    json=body,
                    timeout=None
            ) as response:
                async for chunk in response.aiter_text():
                    yield chunk

    return StreamingResponse(stream_generator(), media_type="text/plain")


# --- 2. GET /api/get-panorama (Прокси-запрос координат) ---
@app.get("/api/get-panorama")
async def proxy_get_panorama(lat: float, lon: float):
    async with httpx.AsyncClient() as client:
        # Пересылаем lat и lon на локальный ПК
        response = await client.get(
            f"{BASE_LOCAL_URL}/get-panorama",
            params={"lat": lat, "lon": lon}
        )
        return response.json()


# --- 3. GET /panorama-image/{file_id} (Выдача из GridFS) ---
@app.get("/panorama-image/{file_id}")
async def proxy_image(file_id: str):
    async with httpx.AsyncClient() as client:
        # Запрашиваем бинарные данные картинки у локального сервера
        response = await client.get(f"{BASE_LOCAL_URL}/panorama-image/{file_id}")

        if response.status_code == 200:
            # Возвращаем картинку с правильным типом контента
            return Response(content=response.content, media_type="image/jpeg")
        return JSONResponse(status_code=404, content={"message": "Image not found"})


# --- 4. Эндпоинт для приема Вебхука (Тот самый из прошлых шагов) ---
@app.post("/api/receive_tour_data")
async def receive_tour_data(data: dict):
    print(f"Данные тура получены: {data}")
    return {"status": "ok"}

@app.post("/api/receive_tour_data")
async def receive_webhook(data: TourCollectedData):
    """
    Сюда твой AI-сервер пришлет итоговый JSON, когда соберет все параметры тура.
    """
    print("=" * 40)
    print(f"🎉 ПРИШЕЛ ВЕБХУК ДЛЯ ПОЛЬЗОВАТЕЛЯ: {data.login}")
    print(f"Статус: {data.status}")
    print(f"Собранные теги: {data.collected_tags}")
    print("=" * 40)

    # === ЗДЕСЬ БУДЕТ ТВОЯ ЛОГИКА ДЛЯ 2GIS ===
    # Например:
    # 1. Извлечь data.collected_tags.get("place_tags")
    # 2. Сделать запрос к API 2GIS
    # 3. Сохранить готовый маршрут в базу данных для этого login

    # Возвращаем 200 OK нашему AI-серверу, чтобы он понял, что мы всё успешно приняли
    return {"status": "success", "message": "Данные для генерации тура получены"}

async def get_coords(address: str, client: httpx.AsyncClient):
    """Яндекс Геокодер: Адрес -> Координаты"""
    params = {"apikey": YANDEX_GEO_KEY, "geocode": address, "format": "json", "results": 1}
    try:
        resp = await client.get("https://geocode-maps.yandex.ru/1.x/", params=params)
        data = resp.json()
        pos = data["response"]["GeoObjectCollection"]["featureMember"][0]["GeoObject"]["Point"]["pos"]
        lon, lat = map(float, pos.split())
        return lat, lon
    except Exception as e:
        logger.error(f"Geocoding error for {address}: {e}")
        return None, None


async def get_yandex_settlement(lat, lon, client: httpx.AsyncClient):
    """Яндекс Расписания: Координаты -> Код города (c213)"""
    params = {"apikey": YANDEX_RASP_KEY, "lat": lat, "lng": lon, "format": "json"}
    try:
        resp = await client.get("https://api.rasp.yandex.net/v3.0/nearest_settlement/", params=params)
        return resp.json().get("code")
    except:
        return None


# --- Логика 2ГИС (Город) ---

async def fetch_2gis(lat1, lon1, lat2, lon2, client: httpx.AsyncClient) -> List[Route]:
    url = f"https://routing.api.2gis.com/public_transport/2.0?key={DGIS_KEY}"
    payload = {
        "locale": "ru",
        "source": {"point": {"lat": lat1, "lon": lon1}},
        "target": {"point": {"lat": lat2, "lon": lon2}},
        "transport": ["bus", "metro", "tram", "trolleybus", "shuttle_bus"],
        "max_walking_distance": 1500
    }

    try:
        resp = await client.post(url, json=payload, timeout=10.0)
        if resp.status_code != 200:
            return []

        data = resp.json()
        routes = []
        for path in data.get("result", []):
            segments = []
            for m in path.get("movements", []):
                m_type = m.get("type", "walk")
                # Форматируем время из 2026-03-21T10:00:00 в 10:00
                dep = m.get("start_time", "").split("T")[-1][:5] if m.get("start_time") else None
                arr = m.get("end_time", "").split("T")[-1][:5] if m.get("end_time") else None

                instr = "Пешком"
                if m_type == "transport":
                    t = m.get("transport", {})
                    instr = f"{t.get('type_name', 'Транспорт')} №{t.get('name', '?')}"

                segments.append(Segment(
                    from_title="Остановка А", to_title="Остановка Б",
                    departure=dep, arrival=arr, type=m_type,
                    duration_min=m.get("duration", 0) // 60, instruction=instr
                ))
            routes.append(
                Route(source="2GIS (Город)", total_min=path.get("total_duration", 0) // 60, segments=segments))
        return routes
    except:
        return []


# --- Логика Яндекса (Межгород) ---

async def fetch_yandex(code1, code2, client: httpx.AsyncClient) -> List[Route]:
    params = {"apikey": YANDEX_RASP_KEY, "from": code1, "to": code2, "format": "json", "transfers": "true"}
    try:
        resp = await client.get("https://api.rasp.yandex.net/v3.0/search/", params=params)
        data = resp.json()
        routes = []
        for seg in data.get("segments", [])[:5]:
            dur = int(seg.get("duration", 0)) // 60
            # Время из 2026-03-21T15:30:00+03:00 -> 15:30
            dep = seg.get("departure", "").split("T")[-1][:5]
            arr = seg.get("arrival", "").split("T")[-1][:5]

            routes.append(Route(
                source="Yandex (Межгород)",
                total_min=dur,
                segments=[Segment(
                    from_title=seg["from"]["title"], to_title=seg["to"]["title"],
                    departure=dep, arrival=arr,
                    type=seg["thread"]["transport_type"], duration_min=dur,
                    instruction=seg["thread"]["title"]
                )]
            ))
        return routes
    except:
        return []


# --- Главный эндпоинт ---

@app.get("/api/routes", response_model=RoutesResponse)
async def get_combined_routes(from_place: str, to_place: str):
    async with httpx.AsyncClient(timeout=20.0) as client:
        # 1. Геокодинг
        lat1, lon1 = await get_coords(from_place, client)
        lat2, lon2 = await get_coords(to_place, client)

        if lat1 is None or lat2 is None:
            raise HTTPException(status_code=404, detail="Не удалось найти координаты одного из адресов")

        # 2. Пытаемся получить 2ГИС (Городской транспорт)
        final_routes = await fetch_2gis(lat1, lon1, lat2, lon2, client)

        # 3. Если 2ГИС пуст или это явно разные города — идем в Яндекс
        if not final_routes:
            code1 = await get_yandex_settlement(lat1, lon1, client)
            code2 = await get_yandex_settlement(lat2, lon2, client)
            if code1 and code2:
                final_routes = await fetch_yandex(code1, code2, client)

        return RoutesResponse(
            from_address=from_place,
            to_address=to_place,
            routes=final_routes,
            message="Маршрутов не найдено" if not final_routes else None
        )


@app.get("/")
async def health():
    return {"status": "ok", "version": "4.1.0"}