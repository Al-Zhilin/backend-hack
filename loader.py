import os
from dotenv import load_dotenv

load_dotenv()

# API Ключи (убедитесь, что они есть в вашем .env файле)
YANDEX_GEO_KEY = os.getenv("YANDEX_GEOCODER_API_KEY", "ВАШ_КЛЮЧ")
YANDEX_RASP_KEY = os.getenv("YANDEX_RASP_API_KEY", "ВАШ_КЛЮЧ")
DGIS_KEY = os.getenv("DGis_API_KEY", "ВАШ_КЛЮЧ")

# Настройки сервера с моделью
BASE_LOCAL_URL = os.getenv("BASE_OF_LOCAL_URL", "http://localhost:5000")

# MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "travel_generator_db"

# API Эндпоинты 2ГИС
DGIS_CATALOG_URL = "https://catalog.api.2gis.com/3.0/items"
DGIS_MATRIX_URL = "https://routing.api.2gis.com/get_dist_matrix/2.0"

# API Эндпоинты Яндекс
YANDEX_GEO_URL = "https://geocode-maps.yandex.ru/1.x/"
YANDEX_RASP_STATIONS_URL = "https://api.rasp.yandex.net/v3.0/nearest_stations/"
YANDEX_RASP_SEARCH_URL = "https://api.rasp.yandex.net/v3.0/search/"