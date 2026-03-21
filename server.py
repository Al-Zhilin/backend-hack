import httpx
import database
import gisapi
from fastapi import FastAPI, Request, Response, HTTPException, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, HTMLResponse, FileResponse
from pydantic import BaseModel
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from loader import BASE_LOCAL_URL

app = FastAPI(title="Transit & Tour Master")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ... (ваши импорты)
from gisapi import GISService


class TourRequest(BaseModel):
    login: str
    message: str


@app.post("/api/chat")
async def chat_and_build_tour(request: TourRequest):
    """
    Проксирует чат, а после завершения стрима (на фронте)
    предполагается вызов логики формирования маршрута.
    Здесь реализуем комбинированный метод.
    """

    async def stream_generator():
        full_response = ""
        async with httpx.AsyncClient() as client:
            # Отправляем запрос к удаленной нейронке
            async with client.stream("POST", f"{BASE_LOCAL_URL}/chat", json=request.dict(), timeout=None) as response:
                async for chunk in response.aiter_text():
                    full_response += chunk
                    yield chunk

        # Здесь логика парсинга тегов из full_response могла бы быть,
        # но обычно теги приходят отдельным полем или в конце.
        # Для примера: предположим, нейронка вернула JSON в конце или мы его парсим.


@app.post("/api/v1/generate-tour-from-tags")
async def generate_tour(tags: List[str], transport_type: str, start_lat: float, start_lon: float):
    """
    Основная логика: Теги -> 2GIS -> TSP -> Yandex (если пешеход)
    """
    # 1. Ищем места через 2GIS
    raw_places = await GISService.find_places_by_tags(tags, f"{start_lon},{start_lat}")
    if not raw_places:
        raise HTTPException(status_code=404, detail="Места не найдены")

    # 2. Решаем задачу коммивояжера
    start_point = {"name": "Начало", "lat": start_lat, "lon": start_lon}
    optimized_route = GISService.solve_tsp(start_point, raw_places)

    # 3. Если пешеход — добавляем расписание Яндекса для каждой точки
    final_data = []
    for point in optimized_route:
        point_info = dict(point)
        if transport_type == "pedestrian":
            point_info["yandex_schedule"] = await GISService.get_yandex_schedule(point["lat"], point["lon"])
        final_data.append(point_info)

    return {
        "transport": transport_type,
        "route": final_data,
        "count": len(final_data)
    }