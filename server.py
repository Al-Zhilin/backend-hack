import httpx
import database
import gisapi
from fastapi import FastAPI, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from datetime import datetime, timezone
from loader import BASE_LOCAL_URL

app = FastAPI(title="Transit & Tour Master API", description="АПИ для генерации туров и общения с LLM")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await database.connect_to_mongo()


@app.on_event("shutdown")
async def shutdown():
    await database.close_mongo()


# --- СХЕМЫ ДАННЫХ ДЛЯ SWAGGER UI ---

class ChatRequest(BaseModel):
    login: str = Field(..., example="user123")
    message: str = Field(..., example="Я хочу погулять пешком по Москве, люблю музеи и кофе.")


class CollectedTags(BaseModel):
    start_location: str = Field(..., example="Москва, Красная площадь 1")
    transport_mode: str = Field(..., example="пешеход")
    categories: List[str] = Field(..., example=["кофейня", "музей"])


class TourCollectedData(BaseModel):
    login: str = Field(..., example="user123")
    status: str = Field(..., example="completed")
    collected_tags: CollectedTags


# --- 1. ПРОКСИ ДЛЯ ЧАТА ---

@app.post("/api/chat", summary="Отправить сообщение нейросети (Streaming)")
async def proxy_chat(data: ChatRequest):
    """
    Отправляет запрос на удаленный сервер с моделью и возвращает ответ по частям (стриминг).
    """

    async def stream_generator():
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream("POST", f"{BASE_LOCAL_URL}/chat", json=data.dict(), timeout=60.0) as response:
                    async for chunk in response.aiter_text():
                        yield chunk
            except Exception as e:
                yield f"Ошибка соединения с LLM: {str(e)}"

    return StreamingResponse(stream_generator(), media_type="text/plain")


# --- 2. ГЕНЕРАЦИЯ ТУРА (ФОНОВАЯ ЗАДАЧА) ---

async def generate_tour_background(data: TourCollectedData):
    """Фоновый воркер генерации тура"""
    try:
        db = await database.get_db()
        tags = data.collected_tags

        # 1. Старт (Яндекс Геокодер)
        start_point = await gisapi.GISService.get_coordinates_yandex(tags.start_location)
        if not start_point:
            start_point = {"name": "Москва-Сити (По умолчанию)", "lat": 55.749, "lon": 37.539}

        # 2. Поиск мест (2ГИС Catalog)
        places = await gisapi.GISService.get_places_by_tags(
            start_point["lat"], start_point["lon"], tags.categories
        )

        # 3. Коммивояжер (2ГИС Матрица)
        optimized_route = await gisapi.GISService.solve_tsp_2gis(
            start_point, places, tags.transport_mode
        )

        # 4. Расписание (Яндекс)
        route_steps = []
        for i in range(len(optimized_route) - 1):
            curr_p, next_p = optimized_route[i], optimized_route[i + 1]
            step = {"from": curr_p, "to": next_p, "schedule": []}

            # Ищем расписание ТОЛЬКО для пешеходов
            if tags.transport_mode.lower() == "пешеход":
                schedule = await gisapi.GISService.get_yandex_schedule(curr_p, next_p)
                step["schedule"] = schedule

            route_steps.append(step)

        # 5. Сохранение в БД
        final_doc = {
            "login": data.login,
            "start_location": tags.start_location,
            "transport_mode": tags.transport_mode,
            "route_steps": route_steps,
            "created_at": datetime.now(timezone.utc)
        }

        await db["generated_tours"].update_one(
            {"login": data.login}, {"$set": final_doc}, upsert=True
        )
        print(f"✅ Тур для {data.login} успешно сгенерирован!")

    except Exception as e:
        print(f"❌ Ошибка генерации тура: {e}")


@app.post("/api/receive_tour_data", summary="Вебхук: Принять данные от LLM и начать генерацию маршрута")
async def receive_webhook(data: TourCollectedData, background_tasks: BackgroundTasks):
    """
    Сюда LLM-сервер (или фронтенд) присылает распознанные теги.
    Сервер мгновенно отвечает 200 OK, а сам сбор данных по API происходит в фоне.
    """
    background_tasks.add_task(generate_tour_background, data)
    return {"status": "success", "message": "Процесс создания тура запущен в фоне"}


@app.get("/api/get_user_route/{login}", summary="Получить готовый маршрут пользователя")
async def get_user_route(login: str):
    """
    Фронтенд периодически дергает этот эндпоинт, чтобы забрать готовый маршрут.
    """
    db = await database.get_db()
    tour = await db["generated_tours"].find_one({"login": login}, {"_id": 0})
    if not tour:
        return JSONResponse(status_code=404, content={"message": "Маршрут еще генерируется или не найден"})
    return tour


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)