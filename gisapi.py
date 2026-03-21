import httpx
import math
import logging
from typing import List
from loader import DGIS_KEY, DGIS_CATALOG_URL, DGIS_ROUTING_URL, DGIS_TRANSPORT_URL, YANDEX_GEO_KEY, YANDEX_RASP_KEY

logger = logging.getLogger(__name__)

class GISService:
    # --- НОВАЯ ЛОГИКА ТУРОВ (ОТЕЛИ, МЕСТА, TSP) ---

    @staticmethod
    async def find_hotel_and_nearby(hotel_query: str, category: str, radius: int):
        async with httpx.AsyncClient() as client:
            # 1. Поиск отеля
            h_res = await client.get(DGIS_CATALOG_URL, params={
                "q": hotel_query, "key": DGIS_KEY, "fields": "items.point"
            })
            if "result" not in h_res.json(): return None, []
            hotel = h_res.json()["result"]["items"][0]
            lat, lon = hotel["point"]["lat"], hotel["point"]["lon"]

            # 2. Поиск мест вокруг
            p_res = await client.get(DGIS_CATALOG_URL, params={
                "q": category, "point": f"{lon},{lat}",
                "radius": radius, "key": DGIS_KEY, "fields": "items.point,items.address_name"
            })
            items = p_res.json().get("result", {}).get("items", [])
            places = [{"name": i["name"], "lat": i["point"]["lat"], "lon": i["point"]["lon"], "address": i.get("address_name", "")} for i in items]
            return hotel, places

    @staticmethod
    def solve_tsp(start_node, locations):
        """Задача коммивояжёра (Ближайший сосед)"""
        ordered = [start_node]
        unvisited = list(locations)
        curr = start_node
        while unvisited:
            next_p = min(unvisited, key=lambda p: math.sqrt((p['lat']-curr['lat'])**2 + (p['lon']-curr['lon'])**2))
            ordered.append(next_p)
            unvisited.remove(next_p)
        return ordered

    @staticmethod
    async def get_road_route(points):
        """Маршрут по дорогам (2ГИС Routing API)"""
        payload = {"points": [{"lat": p["lat"], "lon": p["lon"]} for p in points], "type": "jam", "transport": "car"}
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{DGIS_ROUTING_URL}?key={DGIS_KEY}", json=payload)
            if resp.status_code == 200:
                res = resp.json()["result"][0]
                return {"time_min": round(res["total_duration"]/60, 1), "dist_m": res["total_distance"], "geometry": res["geometry"]["selection"]}
        return None

    # --- ВАША СТАРАЯ ЛОГИКА (ТРАНСПОРТ/ЯНДЕКС) ---

    @staticmethod
    async def get_yandex_coords(address: str):
        params = {"apikey": YANDEX_GEO_KEY, "geocode": address, "format": "json", "results": 1}
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://geocode-maps.yandex.ru/1.x/", params=params)
            pos = resp.json()["response"]["GeoObjectCollection"]["featureMember"][0]["GeoObject"]["Point"]["pos"]
            return map(float, pos.split()) # lon, lat

    @staticmethod
    async def fetch_2gis_transport(lat1, lon1, lat2, lon2):
        payload = {
            "locale": "ru",
            "source": {"point": {"lat": lat1, "lon": lon1}},
            "target": {"point": {"lat": lat2, "lon": lon2}},
            "transport": ["bus", "metro", "tram", "trolleybus", "shuttle_bus"],
            "max_walking_distance": 1500
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{DGIS_TRANSPORT_URL}?key={DGIS_KEY}", json=payload)
            return resp.json().get("result", []) if resp.status_code == 200 else []