import httpx
from fastapi import FastAPI, Request, Response, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from bson import ObjectId
from datetime import datetime, timezone

import database
import gisapi
from loader import BASE_LOCAL_URL

app = FastAPI(title="Transit & Tour Master")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# --- Схемы данных ---
class TourCollectedData(BaseModel):
    login: str
    status: str
    collected_tags: Dict[str, Any]


# --- Инициализация БД ---
@app.on_event("startup")
async def startup():
    await database.connect_to_mongo()


@app.on_event("shutdown")
async def shutdown():
    await database.close_mongo()


# --- 1. ПРОКСИ-ЭНДПОИНТЫ (BASE_LOCAL_URL) ---

@app.post("/api/chat")
async def proxy_chat(request: Request):
    body = await request.json()

    async def stream_generator():
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", f"{BASE_LOCAL_URL}/chat", json=body, timeout=None) as response:
                async for chunk in response.aiter_text():
                    yield chunk

    return StreamingResponse(stream_generator(), media_type="text/plain")


@app.get("/api/get-panorama")
async def proxy_panorama(lat: float, lon: float):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_LOCAL_URL}/get-panorama", params={"lat": lat, "lon": lon})
        return resp.json()


@app.get("/panorama-image/{file_id}")
async def proxy_image(file_id: str):
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BASE_LOCAL_URL}/panorama-image/{file_id}")
        if resp.status_code == 200:
            return Response(content=resp.content, media_type="image/jpeg")
        return JSONResponse(status_code=404, content={"message": "Not found"})


# --- 2. НОВЫЕ ЭНДПОИНТЫ (ТУРЫ + БД ATLAS) ---

@app.post("/api/v1/search-places")
async def search_places(hotel_query: str, category: str, radius: int = 1500):
    db = await database.get_db()
    hotel, places = await gisapi.GISService.find_hotel_and_nearby(hotel_query, category, radius)

    if not hotel: raise HTTPException(status_code=404, detail="Hotel not found")

    # Сохраняем "черновики"
    await db["temp_places"].delete_many({})
    if places:
        inserted = await db["temp_places"].insert_many(places)
        for i, doc_id in enumerate(inserted.inserted_ids):
            places[i]["_id"] = str(doc_id)

    return {"hotel": hotel, "candidates": places}


@app.post("/api/v1/build-tour")
async def build_tour(hotel_data: dict = Body(...), selected_ids: list[str] = Body(...)):
    db = await database.get_db()

    # 1. Достаем из базы выбранные места
    cursor = db["temp_places"].find({"_id": {"$in": [ObjectId(i) for i in selected_ids]}})
    places = await cursor.to_list(length=None)

    # 2. Решаем TSP
    start_p = {"name": hotel_data["name"], "lat": hotel_data["point"]["lat"], "lon": hotel_data["point"]["lon"]}
    optimized_path = gisapi.GISService.solve_tsp(start_p, places)

    # 3. Строим дорогу
    route_meta = await gisapi.GISService.get_road_route(optimized_path)

    # 4. Сохраняем готовый тур
    tour_doc = {
        "user_hotel": hotel_data["name"],
        "route": optimized_path,
        "metrics": route_meta,
        "created_at": datetime.now(timezone.utc)
    }
    res = await db["ready_tours"].insert_one(tour_doc)
    tour_doc["_id"] = str(res.inserted_id)

    return tour_doc


# --- 3. ВЕБХУКИ И ТРАНСПОРТ ---

@app.post("/api/receive_tour_data")
async def receive_webhook(data: TourCollectedData):
    print(f"Пришел вебхук для {data.login}")
    return {"status": "success"}


@app.get("/api/routes")
async def get_routes(from_place: str, to_place: str):
    # Здесь вызываем методы из gisapi.GISService (get_yandex_coords, fetch_2gis_transport)
    # ... (ваша логика вызова) ...
    return {"message": "Logic from gisapi applied"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)