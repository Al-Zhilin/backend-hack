from motor.motor_asyncio import AsyncIOMotorClient
from loader import MONGO_URI, DB_NAME

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_instance = MongoDB()

async def connect_to_mongo():
    try:
        db_instance.client = AsyncIOMotorClient(MONGO_URI)
        db_instance.db = db_instance.client[DB_NAME]
        print("✅ Успешное подключение к MongoDB")
    except Exception as e:
        print(f"❌ Ошибка подключения к MongoDB: {e}")

async def close_mongo():
    if db_instance.client:
        db_instance.client.close()

async def get_db():
    return db_instance.db