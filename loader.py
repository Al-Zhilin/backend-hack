import os
from dotenv import load_dotenv

load_dotenv()

# API Ключи
YANDEX_GEO_KEY = os.getenv("YANDEX_GEOCODER_API_KEY")
YANDEX_RASP_KEY = os.getenv("YANDEX_RASP_API_KEY")
DGIS_KEY = os.getenv("DGis_API_KEY")

# Настройки сервера друга
BASE_LOCAL_URL = "https://ratable-convalescently-epifania.ngrok-free.dev"

# MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://...")
DB_NAME = "travel_generator_db"

# API Эндпоинты 2ГИС
DGIS_CATALOG_URL = "https://catalog.api.2gis.com/3.0/items"
DGIS_ROUTING_URL = "https://routing.api.2gis.com/routing/7.0.0/global"
DGIS_TRANSPORT_URL = "https://routing.api.2gis.com/public_transport/2.0"