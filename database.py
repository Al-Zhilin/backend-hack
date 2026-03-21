from motor.motor_asyncio import AsyncIOMotorClient
from loader import MONGO_URI, DB_NAME

class MongoDB:git
    client: AsyncIOMotorClient = None
    db = None

db_instance = MongoDB()

async def connect_to_mongo():
    db_instance.client = AsyncIOMotorClient(MONGO_URI)
    db_instance.db = db_instance.client[DB_NAME]

async def close_mongo():
    if db_instance.client:
        db_instance.client.close()

async def get_db():
    return db_instance.db