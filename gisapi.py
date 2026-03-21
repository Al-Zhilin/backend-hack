import httpx
import logging
from typing import List, Dict, Any
from datetime import datetime
from loader import (
    DGIS_KEY, DGIS_CATALOG_URL, DGIS_ROUTING_URL, DGIS_MATRIX_URL,
    YANDEX_GEO_KEY, YANDEX_RASP_KEY, YANDEX_GEO_URL, YANDEX_RASP_STATIONS_URL, YANDEX_RASP_SEARCH_URL
)

logger = logging.getLogger(__name__)


class GISService:

    @staticmethod
    async def get_coordinates_yandex(address: str) -> dict:
        """Получение координат старта через Yandex Geocoder"""
        params = {"apikey": YANDEX_GEO_KEY, "geocode": address, "format": "json", "results": 1}
        async with httpx.AsyncClient() as client:
            resp = await client.get(YANDEX_GEO_URL, params=params)
            if resp.status_code == 200:
                data = resp.json()
                try:
                    pos = data["response"]["GeoObjectCollection"]["featureMember"][0]["GeoObject"]["Point"]["pos"]
                    lon, lat = map(float, pos.split())
                    return {"lat": lat, "lon": lon, "name": address}
                except (KeyError, IndexError):
                    pass
        return None

    @staticmethod
    async def get_places_by_tags(lat: float, lon: float, tags: List[str], radius: int = 5000) -> List[dict]:
        """Поиск интересных мест через 2GIS Catalog API по массиву тегов"""
        places = []
        async with httpx.AsyncClient() as client:
            for tag in tags:
                res = await client.get(DGIS_CATALOG_URL, params={
                    "q": tag, "point": f"{lon},{lat}", "radius": radius,
                    "key": DGIS_KEY, "fields": "items.point,items.address_name",
                    "page_size": 2  # Берем 1-2 лучших места по каждому тегу для разнообразия
                })
                items = res.json().get("result", {}).get("items", [])
                for i in items:
                    if "point" in i:
                        places.append({
                            "id": i.get("id"),
                            "name": i["name"],
                            "lat": i["point"]["lat"],
                            "lon": i["point"]["lon"],
                            "address": i.get("address_name", ""),
                            "tag": tag
                        })
        # Убираем дубликаты
        unique_places = {p["id"]: p for p in places if p["id"]}.values()
        return list(unique_places)

    @staticmethod
    async def solve_tsp_2gis(start_point: dict, places: List[dict], transport_mode: str) -> List[dict]:
        """Задача коммивояжера с использованием API Матрицы расстояний 2ГИС"""
        if not places:
            return [start_point]

        points = [start_point] + places
        coords = [{"lat": p["lat"], "lon": p["lon"]} for p in points]

        # profile: driving (авто) или pedestrian (пешеход)
        profile = "driving" if transport_mode.lower() == "машина" else "pedestrian"

        payload = {
            "sources": coords,
            "targets": coords,
            "profile": profile,
            "type": "shortest"  # Ищем оптимальное время (или shortest для расстояния)
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{DGIS_MATRIX_URL}?key={DGIS_KEY}", json=payload)
            if resp.status_code != 200:
                logger.error(f"Ошибка 2GIS Matrix API: {resp.text}")
                return points  # Возвращаем как есть при ошибке

            matrix_data = resp.json().get("routes", [])

            if not matrix_data:
                return points

            # Реализация алгоритма ближайшего соседа по реальной матрице
            ordered = [points[0]]
            unvisited_indices = set(range(1, len(points)))
            curr_idx = 0

            while unvisited_indices:
                # Ищем ближайшую не посещенную точку по времени маршрута
                next_idx = min(
                    unvisited_indices,
                    key=lambda idx: matrix_data[curr_idx][idx]["duration"]
                )
                ordered.append(points[next_idx])
                unvisited_indices.remove(next_idx)
                curr_idx = next_idx

            return ordered

    @staticmethod
    async def get_yandex_schedule(p1: dict, p2: dict) -> List[dict]:
        """Парсинг расписания Яндекс (поиск ближайших станций + расписание между ними)"""
        async with httpx.AsyncClient() as client:
            # 1. Находим код ближайшей станции отправления
            res1 = await client.get(YANDEX_RASP_STATIONS_URL, params={
                "apikey": YANDEX_RASP_KEY, "lat": p1["lat"], "lon": p1["lon"],
                "distance": 3, "format": "json"
            })
            stations1 = res1.json().get("stations", [])
            if not stations1: return []

            # 2. Находим код ближайшей станции прибытия
            res2 = await client.get(YANDEX_RASP_STATIONS_URL, params={
                "apikey": YANDEX_RASP_KEY, "lat": p2["lat"], "lon": p2["lon"],
                "distance": 3, "format": "json"
            })
            stations2 = res2.json().get("stations", [])
            if not stations2: return []

            code_from = stations1[0]["code"]
            code_to = stations2[0]["code"]

            # 3. Ищем расписание между станциями
            sched_res = await client.get(YANDEX_RASP_SEARCH_URL, params={
                "apikey": YANDEX_RASP_KEY, "from": code_from, "to": code_to,
                "format": "json", "date": datetime.now().strftime("%Y-%m-%d")
            })

            threads = sched_res.json().get("segments", [])

            # Возвращаем 3 ближайших рейса
            schedules = []
            for t in threads[:3]:
                schedules.append({
                    "transport_type": t["thread"]["transport_type"],
                    "title": t["thread"]["title"],
                    "departure": t["departure"],
                    "arrival": t["arrival"]
                })
            return schedules