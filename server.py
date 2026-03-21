import httpx
import database
import gisapi
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime, timezone
from loader import BASE_LOCAL_URL

app = FastAPI(title="Transit & Tour Master API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await database.connect_to_mongo()


@app.on_event("shutdown")
async def shutdown():
    await database.close_mongo()


# --- СХЕМЫ ---
class ChatRequest(BaseModel):
    login: str = Field(..., example="user123")
    message: str = Field(..., example="Я хочу погулять пешком по Москве, люблю музеи.")


class CollectedTags(BaseModel):
    start_location: str = Field(..., example="Москва, Красная площадь 1")
    transport_mode: str = Field(..., example="пешеход")
    categories: List[str] = Field(..., example=["кофейня", "музей"])


class TourCollectedData(BaseModel):
    login: str = Field(..., example="user123")
    status: str = Field(..., example="completed")
    collected_tags: CollectedTags


# --- ЭНДПОИНТЫ ---

@app.post("/api/chat")
async def proxy_chat(data: ChatRequest):
    async def stream_generator():
        try:
            async with httpx.AsyncClient() as client:
                # Используем model_dump() вместо dict() для новой Pydantic
                async with client.stream("POST", f"{BASE_LOCAL_URL}/chat", json=data.model_dump(),
                                         timeout=10.0) as response:
                    async for chunk in response.aiter_text():
                        yield chunk
        except httpx.ConnectError:
            yield "❌ ОШИБКА: Не удалось подключиться к серверу с нейромоделью. Убедитесь, что сервер по адресу BASE_LOCAL_URL запущен."
        except Exception as e:
            yield f"❌ Неизвестная ошибка: {str(e)}"

    return StreamingResponse(stream_generator(), media_type="text/plain")


async def generate_tour_background(data: TourCollectedData):
    try:
        print(f"\n🚀 [ФОН] Начинаю генерацию маршрута для {data.login}...")

        db = await database.get_db()
        if db is None:
            print("❌ [ФОН] Ошибка: Нет подключения к базе данных MongoDB!")
            return

        tags = data.collected_tags

        print("📍 1. Получаю координаты старта через Яндекс...")
        start_point = await gisapi.GISService.get_coordinates_yandex(tags.start_location)
        if not start_point:
            print("⚠️ Яндекс не нашел адрес, использую дефолтные координаты (Москва-Сити)")
            start_point = {"name": "Москва-Сити (По умолчанию)", "lat": 55.749, "lon": 37.539}

        print("🏢 2. Ищу места по тегам через 2GIS...")
        places = await gisapi.GISService.get_places_by_tags(start_point["lat"], start_point["lon"], tags.categories)
        print(f"✅ Найдено мест: {len(places)}")

        print("🗺️ 3. Решаю задачу Коммивояжера (Матрица 2GIS)...")
        optimized_route = await gisapi.GISService.solve_tsp_2gis(start_point, places, tags.transport_mode)

        print("🚌 4. Собираю расписание транспорта (Яндекс)...")
        route_steps = []
        for i in range(len(optimized_route) - 1):
            curr_p, next_p = optimized_route[i], optimized_route[i + 1]
            step = {"from": curr_p, "to": next_p, "schedule": []}

            if tags.transport_mode.lower() == "пешеход":
                step["schedule"] = await gisapi.GISService.get_yandex_schedule(curr_p, next_p)

            route_steps.append(step)

        print("💾 5. Сохраняю маршрут в БД...")
        final_doc = {
            "login": data.login,
            "start_location": tags.start_location,
            "transport_mode": tags.transport_mode,
            "route_steps": route_steps,
            "created_at": datetime.now(timezone.utc).isoformat()
            # Сохраняем как строку для избежания проблем с парсингом
        }

        await db["generated_tours"].update_one({"login": data.login}, {"$set": final_doc}, upsert=True)
        print(f"🎉 [ФОН] Маршрут для {data.login} успешно создан и сохранен!\n")

    except Exception as e:
        print(f"❌ [ФОН] КРИТИЧЕСКАЯ ОШИБКА ГЕНЕРАЦИИ: {e}")


@app.post("/api/receive_tour_data")
async def receive_webhook(data: TourCollectedData, background_tasks: BackgroundTasks):
    background_tasks.add_task(generate_tour_background, data)
    return {"status": "success", "message": "Процесс создания тура запущен в фоне, проверьте логи сервера"}


@app.get("/api/get_user_route/{login}")
async def get_user_route(login: str):
    try:
        db = await database.get_db()
        if db is None:
            return JSONResponse(status_code=503, content={"message": "Сервис временно недоступен (Нет связи с БД)"})

        tour = await db["generated_tours"].find_one({"login": login}, {"_id": 0})

        if not tour:
            return JSONResponse(status_code=404, content={"message": "Маршрут еще генерируется или не найден"})

        return tour
    except Exception as e:
        print(f"❌ Ошибка в get_user_route: {e}")
        return JSONResponse(status_code=500, content={"message": f"Внутренняя ошибка сервера: {str(e)}"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)