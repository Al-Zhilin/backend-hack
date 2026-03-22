import httpx
import database
import gisapi
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
from loader import BASE_LOCAL_URL, OPENCV_SERVER_URL

app = FastAPI(title="Transit & Tour Master API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/keys")
async def get_client_keys():
    """Отдаёт VITE_*-конфиг (захардкожено для хакатона)."""
    return {
        "VITE_YANDEX_MAPS_API_KEY": "0052a09e-3633-4c3f-84c1-1c2309b4728b",
        "VITE_GEOAPIFY_API_KEY": "4e3793a793924e688abe127ce6b0549e",
        "VITE_GEOAPIFY_BASE_URL_V1": "https://api.geoapify.com/v1",
        "VITE_GEOAPIFY_BASE_URL_V2": "https://api.geoapify.com/v2",
        "VITE_BACKEND_API_URL": "https://backend-hack-05iw.onrender.com",
        "VITE_OPENAI_API_KEY": "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",
    }


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

@app.post("/api/receive_tour_data")
async def receive_webhook(data: TourCollectedData, background_tasks: BackgroundTasks):
    async def process_tags_to_places(data: TourCollectedData):
        db = await database.get_db()
        tags = data.collected_tags

        start_point = await gisapi.GISService.get_coordinates_yandex(tags.start_location)
        if not start_point:
            start_point = {"name": tags.start_location, "lat": 55.75, "lon": 37.62}

        places = await gisapi.GISService.get_places_by_tags(
            start_point["lat"], start_point["lon"], tags.categories
        )

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

    background_tasks.add_task(process_tags_to_places, data)
    return {"status": "success", "message": "Теги приняты. Ищу места для фронтенда."}


@app.get("/api/get_suggestions/{login}")
async def get_suggestions(login: str):
    db = await database.get_db()
    if db is None:
        return JSONResponse(status_code=503, content={"message": "БД недоступна"})

    suggestion = await db["suggestions"].find_one({"login": login}, {"_id": 0})

    if not suggestion:
        return JSONResponse(status_code=404, content={"message": "Места еще подбираются..."})

    return suggestion


@app.post("/api/chat")
async def proxy_chat(data: ChatRequest):
    async def stream_generator():
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream("POST", f"{BASE_LOCAL_URL}/chat", json=data.model_dump(),
                                         timeout=10.0) as response:
                    async for chunk in response.aiter_text():
                        yield chunk
        except httpx.ConnectError:
            yield "❌ ОШИБКА: Не удалось подключиться к серверу с нейромоделью."
        except Exception as e:
            yield f"❌ Неизвестная ошибка: {str(e)}"

    return StreamingResponse(stream_generator(), media_type="text/plain")


async def build_selected_route_background(data: GenerateRouteRequest):
    try:
        print(f"\n🚀 [ФОН] Строю маршрут по выбранным местам для {data.login}...")
        db = await database.get_db()
        if db is None:
            return

        start_point = data.start_point.model_dump()
        places_dicts = [place.model_dump() for place in data.suggested_places]  # Исправлено на suggested_places

        optimized_route = await gisapi.GISService.solve_tsp_2gis(start_point, places_dicts, data.transport_mode)

        route_steps = []
        for i in range(len(optimized_route) - 1):
            curr_p, next_p = optimized_route[i], optimized_route[i + 1]
            step = {"from": curr_p, "to": next_p, "schedule": []}
            step["schedule"] = await gisapi.GISService.get_yandex_schedule(curr_p, next_p)
            route_steps.append(step)

        final_doc = {
            "login": data.login,
            "start_location": start_point["name"],
            "transport_mode": data.transport_mode,
            "route_steps": route_steps,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # Используем generated_tours
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

    background_tasks.add_task(build_selected_route_background, data)
    return {
        "status": "success",
        "message": "Места получены. Оптимизируем маршрут и ищем транспорт!"
    }


# ==========================================
# ДОБАВЛЕННЫЙ БЛОК: РАБОТА С ПАНОРАМАМИ
# ==========================================

@app.post("/api/panorama/upload")
async def upload_panorama_photos(
        login: str = Form(..., description="Логин пользователя"),
        place_id: str = Form(..., description="ID места из маршрута"),
        files: List[UploadFile] = File(..., description="Исходники фото (до 30 шт)")
):
    """
    Принимает фото с фронтенда, шлет их на удаленный сервер для сшивки,
    получает ссылку на результат и сохраняет в базу.
    """
    if len(files) > 30:
        return JSONResponse(status_code=400, content={"message": "Максимум 30 файлов"})

    db = await database.get_db()
    if db is None:
        return JSONResponse(status_code=503, content={"message": "Нет связи с БД"})

    try:
        # 1. Подготавливаем файлы для пересылки через httpx
        files_for_request = []
        for file in files:
            content = await file.read()
            files_for_request.append(
                ("images", (file.filename, content, file.content_type))
            )

        # Добавляем метаданные, если удаленный сервер их требует
        data_for_request = {"place_id": place_id, "login": login}

        print(f"Отправляю {len(files)} фото на сервер панорам: {OPENCV_SERVER_URL}...")

        # 2. Отправляем на удаленный сервер (Таймаут побольше, сшивка занимает время)
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                OPENCV_SERVER_URL,
                files=files_for_request,
                data=data_for_request
            )

        if response.status_code != 200:
            return JSONResponse(status_code=502, content={"message": f"Ошибка сервера панорам: {response.text}"})

        response_data = response.json()

        # Ожидаем, что удаленный сервер вернет ссылку: {"panorama_url": "https://..."}
        panorama_url = response_data.get("panorama_url")

        if not panorama_url:
            return JSONResponse(status_code=500, content={"message": "Удаленный сервер не вернул ссылку на панораму"})

        # 3. Сохраняем результат в отдельную коллекцию 'panoramas'
        panorama_doc = {
            "login": login,
            "place_id": place_id,
            "panorama_url": panorama_url,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        await db["panoramas"].update_one(
            {"login": login, "place_id": place_id},
            {"$set": panorama_doc},
            upsert=True
        )

        return {"status": "success", "panorama_url": panorama_url}

    except httpx.RequestError as e:
        print(f"❌ Ошибка соединения с сервером панорам: {e}")
        return JSONResponse(status_code=504, content={"message": "Сервер панорам недоступен"})
    except Exception as e:
        print(f"❌ Ошибка загрузки панорамы: {e}")
        return JSONResponse(status_code=500, content={"message": str(e)})


@app.get("/api/get_user_route/{login}")
async def get_user_route(login: str):
    """
    Возвращает сгенерированный маршрут и автоматически
    прикрепляет ссылки на сгенерированные панорамы к нужным точкам.
    """
    try:
        db = await database.get_db()
        if db is None:
            return JSONResponse(status_code=503, content={"message": "Сервис недоступен"})

        # Берем маршрут пользователя
        tour = await db["generated_tours"].find_one({"login": login}, {"_id": 0})

        if not tour:
            return JSONResponse(status_code=404, content={"message": "Маршрут не найден"})

        # Достаем все сгенерированные панорамы пользователя
        panoramas_cursor = db["panoramas"].find({"login": login}, {"_id": 0})
        panoramas = await panoramas_cursor.to_list(length=100)

        # Создаем словарь: { "ID_МЕСТА": "file_id_из_Atlas" }
        pano_dict = {p["place_id"]: p["file_id"] for p in panoramas if "file_id" in p}

        # Вшиваем готовый URL панорамы в маршрут
        # Чтобы фронт мог сделать просто: <img src={point.panorama_url} />
        base_url = "http://ВАШ_ДОМЕН_ИЛИ_IP_ГЛАВНОГО_СЕРВЕРА/api/panorama/image"

        if "route_steps" in tour:
            for step in tour["route_steps"]:
                from_id = step["from"].get("id")
                to_id = step["to"].get("id")

                if from_id in pano_dict:
                    step["from"]["panorama_url"] = f"{base_url}/{pano_dict[from_id]}"
                if to_id in pano_dict:
                    step["to"]["panorama_url"] = f"{base_url}/{pano_dict[to_id]}"

        return tour
    except Exception as e:
        print(f"❌ Ошибка в get_user_route: {e}")
        return JSONResponse(status_code=500, content={"message": str(e)})



@app.post("/api/panorama/upload")
async def upload_panorama_photos(
        login: str = Form(..., description="Логин пользователя"),
        place_id: str = Form(..., description="ID места из маршрута"),
        lat: float = Form(..., description="Широта точки"),
        lon: float = Form(..., description="Долгота точки"),
        files: List[UploadFile] = File(..., description="Исходники фото (до 30 шт)")
):
    """
    Принимает фото от фронта, пересылает на OpenCV сервер,
    получает file_id и сохраняет привязку в БД.
    """
    if len(files) > 30:
        return JSONResponse(status_code=400, content={"message": "Максимум 30 файлов"})

    db = await database.get_db()
    if db is None:
        return JSONResponse(status_code=503, content={"message": "БД недоступна"})

    try:
        # Подготавливаем файлы для пересылки
        files_for_request = []
        for file in files:
            content = await file.read()
            # Важно: ключ должен называться "files", как ожидает OpenCV сервер!
            files_for_request.append(
                ("files", (file.filename, content, file.content_type or "image/jpeg"))
            )

        data_for_request = {"lat": lat, "lon": lon}

        print(f"Отправляю {len(files)} фото на OpenCV сервер...")

        # Пересылаем на OpenCV сервер (Таймаут большой, так как сшивка долгая)
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{OPENCV_SERVER_URL}/upload-my-panorama",
                files=files_for_request,
                data=data_for_request
            )

        if response.status_code != 200:
            return JSONResponse(status_code=response.status_code,
                                content={"message": f"Ошибка OpenCV сервера: {response.text}"})

        # Получаем file_id от OpenCV сервера
        response_data = response.json()
        file_id = response_data.get("file_id")

        if not file_id:
            return JSONResponse(status_code=500, content={"message": "OpenCV сервер не вернул file_id"})

        # Сохраняем в нашу БД привязку места к панораме
        await db["panoramas"].update_one(
            {"login": login, "place_id": place_id},
            {"$set": {
                "login": login,
                "place_id": place_id,
                "file_id": file_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )

        return {
            "status": "success",
            "file_id": file_id,
            "message": "Панорама успешно сшита и сохранена!"
        }

    except httpx.RequestError as e:
        print(f"❌ Ошибка соединения с OpenCV сервером: {e}")
        return JSONResponse(status_code=504, content={"message": "Сервер обработки панорам недоступен"})
    except Exception as e:
        print(f"❌ Ошибка загрузки панорамы: {e}")
        return JSONResponse(status_code=500, content={"message": str(e)})


@app.get("/api/panorama/image/{file_id}")
async def serve_panorama_image(file_id: str):
    """
    Проксирует картинку с OpenCV сервера на Фронтенд.
    Фронтенд вставляет эту ссылку прямо в <img src="...">
    """

    async def image_streamer():
        async with httpx.AsyncClient() as client:
            try:
                # Стримим картинку с OpenCV сервера, не загружая ее целиком в оперативу Main сервера
                async with client.stream("GET", f"{OPENCV_SERVER_URL}/panorama-image/{file_id}") as response:
                    if response.status_code != 200:
                        yield b""  # Ошибка, возвращаем пустоту
                        return
                    async for chunk in response.aiter_bytes():
                        yield chunk
            except Exception as e:
                print(f"Ошибка проксирования картинки: {e}")
                yield b""

    return StreamingResponse(image_streamer(), media_type="image/jpeg")


@app.get("/api/panorama/search")
async def search_existing_panorama(lat: float, lon: float):
    """
    Проксирует запрос на проверку существования панорамы по координатам
    (Если фронт хочет проверить, есть ли уже готовая панорама без загрузки фото)
    """
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                f"{OPENCV_SERVER_URL}/api/get-panorama",
                params={"lat": lat, "lon": lon}
            )
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenCV server unreachable: {e}")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)