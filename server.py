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

STATIC_DIR = Path(__file__).parent / "static"


# --- Схемы данных ---
class TourCollectedData(BaseModel):
    login: str
    status: str
    collected_tags: Dict[str, Any]
    # Ожидаем, что внутри collected_tags есть:
    # "tags": ["музей", "парк"], "transport_mode": "pedestrian" (или "car"), "start_lat": float, "start_lon": float


@app.on_event("startup")
async def startup():
    await database.connect_to_mongo()


@app.on_event("shutdown")
async def shutdown():
    await database.close_mongo()


# --- ПРОКСИ-ЭНДПОИНТЫ НЯРОСЕТИ ---

@app.post("/api/chat")
async def proxy_chat(request: Request):
    """Стриминг общения с нейромоделью"""
    body = await request.json()

    async def stream_generator():
        # timeout=None важен для стриминга долгих ответов LLM
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", f"{BASE_LOCAL_URL}/chat", json=body, timeout=None) as response:
                async for chunk in response.aiter_text():
                    yield chunk

    return StreamingResponse(stream_generator(), media_type="text/plain")


# --- ЛОГИКА СБОРКИ ТУРА (ВЕБХУК) ---

async def background_tour_builder(data: TourCollectedData):
    """Фоновая задача: собирает данные по API и сохраняет готовый тур в БД"""
    db = await database.get_db()

    tags = data.collected_tags.get("tags", [])
    mode = data.collected_tags.get("transport_mode", "car")
    start_lat = data.collected_tags.get("start_lat", 55.7558)  # Дефолт, если не передали
    start_lon = data.collected_tags.get("start_lon", 37.6173)

    start_node = {"name": "Стартовая точка", "lat": start_lat, "lon": start_lon}

    # 1. Ищем локации по тегам
    places = await gisapi.GISService.find_places_by_tags(tags, start_lat, start_lon)

    # 2. Решаем задачу коммивояжера
    optimized_path = gisapi.GISService.solve_tsp(start_node, places)

    # 3. Строим маршрут 2GIS
    route_meta = await gisapi.GISService.get_road_route(optimized_path, transport_mode=mode)

    # 4. Если пешеход — парсим расписание для отрезков (Яндекс)
    schedules = []
    if mode == "pedestrian" and len(optimized_path) > 1:
        # Для примера берем расписание от 1-й до 2-й точки
        p1, p2 = optimized_path[0], optimized_path[1]
        sched = await gisapi.GISService.get_yandex_schedule(p1['lat'], p1['lon'], p2['lat'], p2['lon'])
        schedules.append({"from": p1["name"], "to": p2["name"], "schedule": sched})

    # 5. Сохраняем в MongoDB
    tour_doc = {
        "login": data.login,
        "mode": mode,
        "route": optimized_path,
        "metrics": route_meta,
        "schedules": schedules,
        "status": "ready",
        "created_at": datetime.now(timezone.utc)
    }

    # Обновляем или создаем тур для пользователя
    await db["user_tours"].update_one(
        {"login": data.login},
        {"$set": tour_doc},
        upsert=True
    )
    print(f"Тур для {data.login} успешно собран и сохранен!")


@app.post("/api/receive_tour_data")
async def receive_webhook(data: TourCollectedData, background_tasks: BackgroundTasks):
    """Принимает данные от ML-сервера и запускает сборку в фоне"""
    print(f"Пришел вебхук для {data.login}. Запускаем сборку тура...")

    # Отдаем задачу в фон, чтобы моментально ответить ML-серверу 200 OK
    background_tasks.add_task(background_tour_builder, data)

    return {"status": "processing_started"}


@app.get("/api/get_tour/{login}")
async def get_ready_tour(login: str):
    """Фронтенд дергает этот эндпоинт, чтобы получить готовый маршрут"""
    db = await database.get_db()
    tour = await db["user_tours"].find_one({"login": login}, {"_id": 0})

    if not tour:
        return JSONResponse(status_code=202, content={"status": "processing", "message": "Тур еще собирается"})

    return {"status": "success", "data": tour}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)