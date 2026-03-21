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
class SuggestedTourData(BaseModel):
    login: str
    start_point: dict
    transport_mode: str
    suggested_places: List[dict]

class PlaceItem(BaseModel):
    id: str = Field(..., description="ID из 2GIS или сгенерированный")
    name: str
    lat: float
    lon: float
    address: str
    tag: str

class StartPoint(BaseModel):
    name: str
    lat: float
    lon: float

class GenerateRouteRequest(BaseModel):
    login: str
    transport_mode: str
    start_point: StartPoint
    suggested_places: List[PlaceItem] = Field(..., description="Список мест, которые выбрал пользователь")

class ChatRequest(BaseModel):
    login: str = Field(..., example="user123")
    text: str = Field(..., example="Я хочу погулять пешком по Москве, люблю музеи.")

class CollectedTags(BaseModel):
    start_location: str = Field(..., example="Москва, Красная площадь 1")
    transport_mode: str = Field(..., example="пешеход")
    categories: List[str] = Field(..., example=["кофейня", "музей"])

class TourCollectedData(BaseModel):
    login: str = Field(..., example="user123")
    status: str = Field(..., example="completed")
    collected_tags: CollectedTags

# --- ЭНДПОИНТЫ ---
# 1. ЭНДПОИНТ ДЛЯ НЕЙРОСЕТИ (Webhook)
@app.post("/api/receive_tour_data")
async def receive_webhook(data: TourCollectedData, background_tasks: BackgroundTasks):
    """
    Нейросеть отправляет сюда теги. Мы переделываем логику:
    вместо генерации всего маршрута, мы только ищем места и кладем их в буфер для Фронтенда.
    """

    async def process_tags_to_places(data: TourCollectedData):
        db = await database.get_db()
        tags = data.collected_tags

        # 1. Ищем старт
        start_point = await gisapi.GISService.get_coordinates_yandex(tags.start_location)
        if not start_point:
            start_point = {"name": tags.start_location, "lat": 55.75, "lon": 37.62}

        # 2. Ищем места в 2ГИС
        places = await gisapi.GISService.get_places_by_tags(
            start_point["lat"], start_point["lon"], tags.categories
        )

        # 3. Сохраняем в коллекцию 'suggestions', чтобы Фронтенд мог их забрать!
        await db["suggestions"].update_one(
            {"login": data.login},
            {"$set": {
                "login": data.login,
                "start_point": start_point,
                "transport_mode": tags.transport_mode,
                "suggested_places": places
            }},
            upsert=True
        )

    # Запускаем в фоне, чтобы нейросеть сразу получила ответ "ок"
    background_tasks.add_task(process_tags_to_places, data)
    return {"status": "success", "message": "Теги приняты. Ищу места для фронтенда."}

@app.get("/api/get_suggestions/{login}")
async def get_suggestions(login: str):
    """
    Фронтенд вызывает этот роут, чтобы проверить,
    подготовил ли сервер места на основе тегов от ИИ.
    """
    db = await database.get_db()
    if db is None:
        return JSONResponse(status_code=503, content={"message": "БД недоступна"})

    suggestion = await db["suggestions"].find_one({"login": login}, {"_id": 0})

    if not suggestion:
        return JSONResponse(status_code=404, content={"message": "Места еще подбираются..."})

    return suggestion

@app.post("/api/generate_route")
async def generate_route_endpoint(data: GenerateRouteRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(build_selected_route_background, data)
    return {"status": "success", "message": "Маршрут оптимизируется..."}

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


async def build_selected_route_background(data: GenerateRouteRequest):
    try:
        print(f"\n🚀 [ФОН] Строю маршрут по выбранным местам для {data.login}...")

        db = await database.get_db()
        if db is None:
            print("❌ [ФОН] Ошибка: Нет подключения к БД!")
            return

        start_point = data.start_point.model_dump()
        # Превращаем Pydantic объекты в обычные словари для gisapi
        places_dicts = [place.model_dump() for place in data.selected_places]

        print("🗺️ Решаю задачу Коммивояжера для выбранных точек...")
        optimized_route = await gisapi.GISService.solve_tsp_2gis(
            start_point,
            places_dicts,
            data.transport_mode
        )

        print("🚌 Собираю расписание транспорта...")
        route_steps = []
        for i in range(len(optimized_route) - 1):
            curr_p, next_p = optimized_route[i], optimized_route[i + 1]
            step = {"from": curr_p, "to": next_p, "schedule": []}

            # Ищем расписание (если нужно, уберите проверку на пешехода, чтобы транспорт искался всегда)
            step["schedule"] = await gisapi.GISService.get_yandex_schedule(curr_p, next_p)
            route_steps.append(step)

        print("💾 Сохраняю итоговый маршрут в БД...")
        final_doc = {
            "login": data.login,
            "start_location": start_point["name"],
            "transport_mode": data.transport_mode,
            "route_steps": route_steps,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # Сохраняем в коллекцию (убедитесь, что название совпадает с вашим MongoDB Atlas, например "Users" или "generated_tours")
        await db["generated_tours"].update_one(
            {"login": data.login},
            {"$set": final_doc},
            upsert=True
        )
        print(f"🎉 [ФОН] Маршрут для {data.login} успешно создан!\n")

    except Exception as e:
        print(f"❌ [ФОН] ОШИБКА СБОРКИ МАРШРУТА: {e}")


@app.post("/api/generate_route")
async def generate_route_endpoint(data: GenerateRouteRequest, background_tasks: BackgroundTasks):
    if not data.suggested_places:
        return JSONResponse(status_code=400, content={"message": "Вы не выбрали ни одного места!"})

    # Запускаем сборку маршрута в фоне
    background_tasks.add_task(build_selected_route_background, data)

    return {
        "status": "success",
        "message": "Места получены. Оптимизируем маршрут и ищем транспорт!"
    }


@app.get("/api/get_user_route/{login}")
async def get_user_route(login: str):
    try:
        db = await database.get_db()
        if db is None:
            return JSONResponse(status_code=503, content={"message": "Сервис временно недоступен (Нет связи с БД)"})

        tour = await db["Places"].find_one({"login": login}, {"_id": 0})

        if not tour:
            return JSONResponse(status_code=404, content={"message": "Маршрут еще генерируется или не найден"})

        return tour
    except Exception as e:
        print(f"❌ Ошибка в get_user_route: {e}")
        return JSONResponse(status_code=500, content={"message": f"Внутренняя ошибка сервера: {str(e)}"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)