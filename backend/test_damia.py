"""
Тестирование DaMIA API - проверка корректности ссылок на kad.arbitr.ru
"""
import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

DAMIA_API_URL = "https://api.damia.ru/arb/delo"
DAMIA_API_KEY = os.getenv("DAMIA_API_KEY", "")

# Тестовые номера дел (реальные дела из арбитражных судов)
TEST_CASES = [
    "А40-1000/2024",      # Арбитражный суд г. Москвы
    "А60-50000/2023",     # Арбитражный суд Свердловской области
    "А56-30000/2023",     # Арбитражный суд СПб
    "А41-20000/2024",     # Арбитражный суд Московской области
    "А40-123456789/2024", # Несуществующий номер для проверки
]


async def test_damia_case(case_number: str) -> dict:
    """Тестирует один номер дела через DaMIA API"""

    if not DAMIA_API_KEY:
        return {"case": case_number, "error": "API key not configured"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            params = {
                "regn": case_number,
                "key": DAMIA_API_KEY
            }

            response = await client.get(DAMIA_API_URL, params=params)

            result = {
                "case": case_number,
                "status_code": response.status_code,
                "raw_response": None,
                "url": None,
                "url_valid": None,
                "court": None,
                "date": None,
            }

            if response.status_code == 200:
                data = response.json()
                result["raw_response"] = data

                # Парсим данные
                if isinstance(data, list) and len(data) > 0:
                    case_data = data[0]
                elif isinstance(data, dict):
                    case_data = data
                else:
                    case_data = None

                if case_data:
                    result["url"] = case_data.get("Url")
                    result["court"] = case_data.get("Суд")
                    result["date"] = case_data.get("Дата")
                    result["reg_number"] = case_data.get("РегНомер")
                    result["plaintiff"] = case_data.get("Истец")
                    result["defendant"] = case_data.get("Ответчик")

                    # Проверяем валидность URL
                    if result["url"]:
                        try:
                            url_response = await client.head(result["url"], follow_redirects=True, timeout=10.0)
                            result["url_valid"] = url_response.status_code == 200
                            result["url_final"] = str(url_response.url)
                        except Exception as e:
                            result["url_valid"] = False
                            result["url_error"] = str(e)

            return result

    except Exception as e:
        return {"case": case_number, "error": str(e)}


async def main():
    print("=" * 80)
    print("ТЕСТИРОВАНИЕ DaMIA API")
    print("=" * 80)
    print(f"\nAPI URL: {DAMIA_API_URL}")
    print(f"API Key configured: {bool(DAMIA_API_KEY)}")
    if DAMIA_API_KEY:
        print(f"API Key prefix: {DAMIA_API_KEY[:8]}...")
    print()

    for case_number in TEST_CASES:
        print("-" * 60)
        print(f"Проверяю: {case_number}")

        result = await test_damia_case(case_number)

        if "error" in result:
            print(f"  ❌ Ошибка: {result['error']}")
        elif result.get("status_code") == 200 and result.get("raw_response"):
            print(f"  ✅ Найдено!")
            print(f"     Рег.номер: {result.get('reg_number')}")
            print(f"     Суд: {result.get('court')}")
            print(f"     Дата: {result.get('date')}")
            print(f"     Истец: {result.get('plaintiff')}")
            print(f"     Ответчик: {result.get('defendant')}")
            print(f"     URL: {result.get('url')}")
            if result.get("url"):
                if result.get("url_valid"):
                    print(f"     ✅ URL валиден")
                    if result.get("url_final") != result.get("url"):
                        print(f"     → Редирект на: {result.get('url_final')}")
                else:
                    print(f"     ❌ URL невалиден: {result.get('url_error', 'недоступен')}")
        else:
            print(f"  ⚠️  Не найдено (HTTP {result.get('status_code')})")

        print()

    print("=" * 80)
    print("Тестирование завершено")


if __name__ == "__main__":
    asyncio.run(main())
