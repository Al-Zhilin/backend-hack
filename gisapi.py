import httpx
import math
from typing import List, Dict, Any
from loader import DGIS_KEY, DGIS_CATALOG_URL, DGIS_ROUTING_URL, YANDEX_GEO_KEY, YANDEX_RASP_KEY


class GISService:
    @staticmethod
    async def find_places_by_tags(tags: List[str], city_center: str = "37.6176,55.7558") -> List[Dict]:
        """Поиск мест в 2GIS по набору тегов"""
        all_places = []
        async with httpx.AsyncClient() as client:
            for tag in tags:
                resp = await client.get(DGIS_CATALOG_URL, params={
                    "q": tag,
                    "point": city_center,
                    "radius": 5000,
                    "key": DGIS_KEY,
                    "fields": "items.point,items.address_name"
                })
                if resp.status_code == 200 and "result" in resp.json():
                    items = resp.json()["result"]["items"]
                    for i in items:
                        all_places.append({
                            "name": i["name"],
                            "lat": i["point"]["lat"],
                            "lon": i["point"]["lon"],
                            "address": i.get("address_name", ""),
                            "tag": tag
                        })
        return all_places

    @staticmethod
    def solve_tsp(start_node: Dict, locations: List[Dict]) -> List[Dict]:
        """Алгоритм ближайшего соседа для сортировки точек"""
        ordered = [start_node]
        unvisited = list(locations)
        curr = start_node
        while unvisited:
            next_p = min(unvisited, key=lambda p: math.hypot(p['lat'] - curr['lat'], p['lon'] - curr['lon']))
            ordered.append(next_p)
            unvisited.remove(next_p)
        return ordered

    @staticmethod
    async def get_yandex_schedule(lat: float, lon: float) -> Dict:
        """Получение расписания ближайшего транспорта через Яндекс"""
        async with httpx.AsyncClient() as client:
            # 1. Ищем ближайшую станцию/остановку
            st_res = await client.get("https://api.rasp.yandex.net/v3.0/nearest_stations/", params={
                "apikey": YANDEX_RASP_KEY, "lat": lat, "lng": lon, "distance": 1000, "format": "json"
            })
            if st_res.status_code != 200 or not st_res.json().get("stations"):
                return {"schedule": "Нет данных"}

            station_code = st_res.json()["stations"][0]["code"]

            # 2. Берем расписание по этой станции
            sched_res = await client.get("https://api.rasp.yandex.net/v3.0/schedule/", params={
                "apikey": YANDEX_RASP_KEY, "station": station_code, "format": "json"
            })
            return sched_res.json() if sched_res.status_code == 200 else {}