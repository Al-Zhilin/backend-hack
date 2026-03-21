from motor.motor_asyncio import AsyncIOMotorClient
from loader import MONGO_URI, DB_NAME
import logging

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_instance = MongoDB()

async def connect_to_mongo():
    try:
        # Добавлен таймаут 5 секунд, чтобы сервер не висел вечно
        db_instance.client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db_instance.db = db_instance.client[DB_NAME]
        # Проверяем жива ли база
        await db_instance.client.server_info()
        print("✅ Успешное подключение к MongoDB")
    except Exception as e:
        print(f"❌ ОШИБКА ПОДКЛЮЧЕНИЯ К MongoDB: Проверьте, запущена ли БД! Ошибка: {e}")
        db_instance.db = None

async def close_mongo():
    if db_instance.client:
        db_instance.client.close()

async def get_db():
    return db_instance.db