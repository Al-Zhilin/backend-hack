import httpx
import logging
from typing import List, Dict, Any
from datetime import datetime
from loader import (
    DGIS_KEY, DGIS_CATALOG_URL, DGIS_MATRIX_URL,
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
                try:
                    data = resp.json()
                    pos = data["response"]["GeoObjectCollection"]["featureMember"][0]["GeoObject"]["Point"]["pos"]
                    lon, lat = map(float, pos.split())  # Яндекс возвращает 'lon lat'
                    return {"name": address, "lat": lat, "lon": lon}
                except (KeyError, IndexError):
                    logger.error("Адрес не найден в Яндексе")
        return None

    @staticmethod
    async def get_places_by_tags(lat: float, lon: float, tags: List[str], radius: int = 3000) -> List[dict]:
        """Поиск мест через 2GIS Catalog API по массиву тегов"""
        places = []
        async with httpx.AsyncClient() as client:
            for tag in tags:
                res = await client.get(DGIS_CATALOG_URL, params={
                    "q": tag, "point": f"{lon},{lat}", "radius": radius,
                    "key": DGIS_KEY, "fields": "items.point,items.address_name",
                    "page_size": 2  # Берем по 2 лучших места на каждый тег
                })
                if res.status_code == 200:
                    items = res.json().get("result", {}).get("items", [])
                    for i in items:
                        if "point" in i:
                            places.append({
                                "id": i.get("id", ""),
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
        """Задача Коммивояжера с использованием Матрицы Расстояний 2ГИС"""
        if not places: return [start_point]

        points = [start_point] + places
        points_coords = [{"lat": p["lat"], "lon": p["lon"]} for p in points]
        indices = list(range(len(points_coords)))

        # profile: driving (авто) или pedestrian (пешеход)
        profile = "driving" if transport_mode.lower() in ["машина", "авто"] else "pedestrian"

        payload = {
            "points": points_coords,
            "sources": indices,
            "targets": indices,
            "profile": profile,
            "type": "shortest"
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{DGIS_MATRIX_URL}?key={DGIS_KEY}", json=payload)
            if resp.status_code != 200:
                logger.error(f"Ошибка 2GIS Matrix API: {resp.text}")
                return points  # В случае ошибки возвращаем как есть

            routes = resp.json().get("routes", [])

            # Строим матрицу смежности [source][target] = duration
            matrix = {i: {j: float('inf') for j in indices} for i in indices}
            for r in routes:
                matrix[r["source_id"]][r["target_id"]] = r["duration"]

            # Алгоритм Ближайшего Соседа (Nearest Neighbor)
            ordered = [points[0]]
            unvisited = set(indices[1:])
            curr_idx = 0

            while unvisited:
                # Находим ближайшую точку по времени в пути (duration)
                next_idx = min(unvisited, key=lambda idx: matrix[curr_idx][idx])
                ordered.append(points[next_idx])
                unvisited.remove(next_idx)
                curr_idx = next_idx

            return ordered

    @staticmethod
    async def get_yandex_schedule(p1: dict, p2: dict) -> List[dict]:
        """Получение расписания от Яндекса между двумя точками"""
        try:
            async with httpx.AsyncClient() as client:
                # 1. Станция отправления
                res1 = await client.get(YANDEX_RASP_STATIONS_URL, params={
                    "apikey": YANDEX_RASP_KEY, "lat": p1["lat"], "lon": p1["lon"], "distance": 2, "format": "json"
                })
                stations1 = res1.json().get("stations", [])
                if not stations1: return [{"title": "Поблизости нет остановок отправления"}]

                # 2. Станция прибытия
                res2 = await client.get(YANDEX_RASP_STATIONS_URL, params={
                    "apikey": YANDEX_RASP_KEY, "lat": p2["lat"], "lon": p2["lon"], "distance": 2, "format": "json"
                })
                stations2 = res2.json().get("stations", [])
                if not stations2: return [{"title": "Поблизости нет остановок прибытия"}]

                code_from, code_to = stations1[0]["code"], stations2[0]["code"]

                # 3. Поиск маршрутов
                sched_res = await client.get(YANDEX_RASP_SEARCH_URL, params={
                    "apikey": YANDEX_RASP_KEY, "from": code_from, "to": code_to,
                    "format": "json", "date": datetime.now().strftime("%Y-%m-%d")
                })

                threads = sched_res.json().get("segments", [])
                if not threads:
                    return [{"title": "Прямых маршрутов нет, воспользуйтесь такси или идите пешком"}]

                # Возвращаем 3 ближайших рейса
                return [{
                    "transport_type": t["thread"]["transport_type"],
                    "number": t["thread"].get("number", ""),
                    "title": t["thread"]["title"],
                    "departure": t["departure"],
                    "arrival": t["arrival"]
                } for t in threads[:3]]
        except Exception as e:
            logger.error(f"Ошибка парсинга Яндекса: {e}")
            return [{"title": "Ошибка получения расписания"}]