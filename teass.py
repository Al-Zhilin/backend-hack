import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()


async def setup_atlas():
    uri = os.getenv("MONGO_URI")
    db_name = os.getenv("DB_NAME")

    if not uri or "xxxx" in uri:
        print("❌ Ошибка: Вы не настроили MONGO_URI в .env!")
        return

    client = AsyncIOMotorClient(uri)
    db = client[db_name]

    print(f"📡 Подключение к Atlas и настройка базы '{db_name}'...")

    try:
        # 1. Создаем уникальный индекс на поле login
        # Это ускорит поиск в эндпоинте /api/get_user_route/{login}
        await db["generated_tours"].create_index("login", unique=True)

        # Проверяем соединение
        await client.server_info()
        print("✅ Успешно! Индексы созданы, база готова к работе.")

    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(setup_atlas())