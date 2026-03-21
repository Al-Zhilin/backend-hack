import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def test():
    # ПОДСТАВЬТЕ СВОЮ ССЫЛКУ ИЗ ATLAS ТУТ:
    uri = "mongodb+srv://lukalex29:lukalex29@cluster0.f6190ex.mongodb.net/"
    client = AsyncIOMotorClient(uri)
    try:
        # Пытаемся получить список коллекций в базе TourProject
        db = client["TourProject"]
        collections = await db.list_collection_names()
        print(f"✅ Соединение установлено!")
        print(f"📂 Коллекции в TourProject: {collections}")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    finally:
        client.close()

asyncio.run(test())