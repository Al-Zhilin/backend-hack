import httpx
import database
import gisapi
from fastapi import FastAPI, Request, Response, HTTPException, Body, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
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
    # Ожидаемый вид collected_tags от нейросети:
    # {
    #   "start_location": "Отель Азимут, Москва",
    #   "transport_mode": "пешеход", // или "машина"
    #   "categories": ["музеи", "парки", "кофейни"]
    # }


@app.on_event("startup")
async def startup():
    await database.connect_to_mongo()


@app.on_event("shutdown")
async def shutdown():
    await database.close_mongo()


# --- 1. ПРОКСИ-ЭНДПОИНТЫ ДЛЯ НЕЙРОМОДЕЛИ ---

@app.post("/api/chat")
async def proxy_chat(request: Request):
    """
    Проксирует запрос к удаленному серверу с моделью и возвращает ответ стримингом (по кускам).
    Пользователь не ждет генерации всего ответа.
    """
    body = await request.json()

    async def stream_generator():
        async with httpx.AsyncClient() as client:
            try:
                # Тайм-аут увеличен, т.к. LLM может "думать" до начала ответа
                async with client.stream("POST", f"{BASE_LOCAL_URL}/chat", json=body, timeout=60.0) as response:
                    async for chunk in response.aiter_text():
                        yield chunk
            except Exception as e:
                yield f"Error connecting to LLM server: {str(e)}"

    return StreamingResponse(stream_generator(), media_type="text/plain")


# --- 2. ГЕНЕРАЦИЯ ТУРА: СВЯЗКА ВЕБХУКА, 2ГИС И ЯНДЕКСА ---

async def generate_tour_background(data: TourCollectedData):
    """Фоновая задача, которая вызывается, когда модель собрала все данные"""
    try:
        db = await database.get_db()
        tags_info = data.collected_tags

        start_location_name = tags_info.get("start_location", "Москва, Красная площадь")
        transport_mode = tags_info.get("transport_mode", "пешеход")
        categories = tags_info.get("categories", [])

        # 1. Получаем координаты старта (Yandex Geocoder)
        start_point = await gisapi.GISService.get_coordinates_yandex(start_location_name)
        if not start_point:
            start_point = {"lat": 55.7558, "lon": 37.6173, "name": "Центр (По умолчанию)"}  # Fallback

        # 2. Ищем места по тегам (2ГИС)
        places = await gisapi.GISService.get_places_by_tags(start_point["lat"], start_point["lon"], categories)

        # 3. Решаем задачу коммивояжера (через Матрицу расстояний 2ГИС)
        optimized_route = await gisapi.GISService.solve_tsp_2gis(start_point, places, transport_mode)

        # 4. Если пешеход -> собираем расписание (Yandex Raspisanie)
        route_with_schedules = []
        for i in range(len(optimized_route) - 1):
            current_p = optimized_route[i]
            next_p = optimized_route[i + 1]

            leg = {"from": current_p, "to": next_p, "schedule": []}

            if transport_mode.lower() == "пешеход":
                schedule = await gisapi.GISService.get_yandex_schedule(current_p, next_p)
                leg["schedule"] = schedule

            route_with_schedules.append(leg)

        # 5. Сохраняем в БД для конкретного юзера
        final_doc = {
            "login": data.login,
            "start_location": start_location_name,
            "transport_mode": transport_mode,
            "route_steps": route_with_schedules,
            "created_at": datetime.now(timezone.utc)
        }

        # Обновляем или создаем тур пользователя
        await db["generated_tours"].update_one(
            {"login": data.login},
            {"$set": final_doc},
            upsert=True
        )
        print(f"Тур для пользователя {data.login} успешно сгенерирован и сохранен!")

    except Exception as e:
        print(f"Ошибка при фоновой генерации тура: {e}")


@app.post("/api/receive_tour_data")
async def receive_webhook(data: TourCollectedData, background_tasks: BackgroundTasks):
    """Сюда LLM-сервер отправляет JSON с распознанными параметрами"""
    print(f"Пришел вебхук (данные) для логина: {data.login}")

    # Добавляем долгую генерацию 2ГИС/Яндекс в фоновые задачи, чтобы мгновенно отдать 200 OK
    background_tasks.add_task(generate_tour_background, data)

    return {"status": "success", "message": "Tour generation started"}


@app.get("/api/get_user_route/{login}")
async def get_user_route(login: str):
    """Эндпоинт для frontend'a: получить готовый рассчитанный маршрут"""
    db = await database.get_db()
    tour = await db["generated_tours"].find_one({"login": login}, {"_id": 0})
    if not tour:
        return JSONResponse(status_code=404, content={"message": "Route is processing or not found"})
    return tour


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)