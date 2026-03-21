import httpx
import math
import logging
from typing import List, Dict, Any
from loader import DGIS_KEY, DGIS_CATALOG_URL, DGIS_ROUTING_URL, YANDEX_GEO_KEY, YANDEX_RASP_KEY

logger = logging.getLogger(__name__)


class GISService:

    @staticmethod
    def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Вычисляет расстояние между двумя координатами в метрах"""
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    @staticmethod
    async def find_places_by_tags(tags: List[str], start_lat: float, start_lon: float, radius: int = 3000) -> List[
        dict]:
        """Ищет места в 2GIS на основе списка тегов от нейросети"""
        places = []
        async with httpx.AsyncClient() as client:
            for tag in tags:
                resp = await client.get(DGIS_CATALOG_URL, params={
                    "q": tag, "point": f"{start_lon},{start_lat}",
                    "radius": radius, "key": DGIS_KEY, "fields": "items.point,items.address_name"
                })
                items = resp.json().get("result", {}).get("items", [])
                for i in items[:3]:  # Берем топ-3 по каждому тегу, чтобы не перегрузить маршрут
                    places.append({
                        "name": i["name"],
                        "lat": i["point"]["lat"],
                        "lon": i["point"]["lon"],
                        "address": i.get("address_name", ""),
                        "tag": tag
                    })
        return places

    @staticmethod
    def solve_tsp(start_node: dict, locations: List[dict]) -> List[dict]:
        """Задача коммивояжёра (Ближайший сосед с учетом кривизны земли)"""
        if not locations:
            return [start_node]

        ordered = [start_node]
        unvisited = list(locations)
        curr = start_node

        while unvisited:
            # Используем Haversine вместо обычной евклидовой метрики
            next_p = min(unvisited, key=lambda p: GISService.haversine(curr['lat'], curr['lon'], p['lat'], p['lon']))
            ordered.append(next_p)
            unvisited.remove(next_p)
            curr = next_p

        return ordered

    @staticmethod
    async def get_road_route(points: List[dict], transport_mode: str = "car") -> dict:
        """Получает геометрию маршрута от 2GIS (car или pedestrian)"""
        mode = "pedestrian" if transport_mode == "pedestrian" else "car"
        payload = {
            "points": [{"lat": p["lat"], "lon": p["lon"]} for p in points],
            "type": "jam" if mode == "car" else "shortest",
            "transport": mode
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{DGIS_ROUTING_URL}?key={DGIS_KEY}", json=payload)
            if resp.status_code == 200:
                res = resp.json()["result"][0]
                return {
                    "time_min": round(res["total_duration"] / 60, 1),
                    "dist_m": res["total_distance"],
                    "geometry": res.get("geometry", {}).get("selection", "")
                }
        return {"error": "Route not found"}

    @staticmethod
    async def get_yandex_schedule(lat_from: float, lon_from: float, lat_to: float, lon_to: float) -> List[dict]:
        """Получает расписание транспорта между двумя точками через Яндекс.Расписания"""
        async with httpx.AsyncClient() as client:
            # 1. Ищем код ближайшей станции отправления
            st_from_resp = await client.get("https://api.rasp.yandex.net/v3.0/nearest_stations/", params={
                "apikey": YANDEX_RASP_KEY, "lat": lat_from, "lng": lon_from, "distance": 2, "format": "json"
            })

            # 2. Ищем код ближайшей станции прибытия
            st_to_resp = await client.get("https://api.rasp.yandex.net/v3.0/nearest_stations/", params={
                "apikey": YANDEX_RASP_KEY, "lat": lat_to, "lng": lon_to, "distance": 2, "format": "json"
            })

            stations_from = st_from_resp.json().get("stations", [])
            stations_to = st_to_resp.json().get("stations", [])

            if not stations_from or not stations_to:
                return [{"error": "Станции не найдены рядом с точками"}]

            code_from = stations_from[0]["code"]
            code_to = stations_to[0]["code"]

            # 3. Ищем расписание между станциями
            schedule_resp = await client.get("https://api.rasp.yandex.net/v3.0/search/", params={
                "apikey": YANDEX_RASP_KEY, "from": code_from, "to": code_to, "format": "json", "limit": 3
            })

            segments = schedule_resp.json().get("segments", [])
            return [{
                "thread": s["thread"]["title"],
                "departure": s["departure"],
                "arrival": s["arrival"],
                "duration_min": s["duration"] / 60
            } for s in segments]