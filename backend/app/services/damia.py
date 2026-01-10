"""
DaMIA API Service - верификация судебных дел через API kad.arbitr.ru
"""
import httpx
import logging
from typing import Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

DAMIA_API_URL = "https://api.damia.ru/arb/delo"


async def verify_case_damia(case_number: str) -> Dict[str, Any]:
    """
    Проверяет существование дела через DaMIA API (kad.arbitr.ru)

    Args:
        case_number: Номер дела (например "А40-12345/2024")

    Returns:
        Dict с полями:
        - exists: bool - существует ли дело
        - case_data: dict - данные по делу (если найдено)
        - error: str - сообщение об ошибке (если была)
    """
    if not settings.damia_api_key:
        logger.warning("DaMIA API key not configured")
        return {"exists": False, "error": "API key not configured"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            params = {
                "regn": case_number,
                "key": settings.damia_api_key
            }

            response = await client.get(DAMIA_API_URL, params=params)

            if response.status_code != 200:
                logger.warning(f"DaMIA API returned {response.status_code} for case {case_number}")
                return {"exists": False, "error": f"HTTP {response.status_code}"}

            data = response.json()

            # Парсим данные - может быть список или объект
            if isinstance(data, list) and len(data) > 0:
                case_data = data[0]
            elif isinstance(data, dict) and data:
                case_data = data
            else:
                return {"exists": False}

            # Форматируем результат
            return {
                "exists": True,
                "case_data": {
                    "url": case_data.get("Url"),
                    "court": case_data.get("Суд"),
                    "date": case_data.get("Дата"),
                    "reg_number": case_data.get("РегНомер"),
                    "plaintiff": case_data.get("Истец"),
                    "defendant": case_data.get("Ответчик"),
                    "status": case_data.get("Статус"),
                    "judge": case_data.get("Судья"),
                    "amount": case_data.get("Сумма"),
                    "summary": _build_summary(case_data)
                }
            }

    except httpx.TimeoutException:
        logger.error(f"DaMIA API timeout for case {case_number}")
        return {"exists": False, "error": "Timeout"}
    except Exception as e:
        logger.error(f"DaMIA API error for case {case_number}: {e}")
        return {"exists": False, "error": str(e)}


def _build_summary(case_data: Dict) -> str:
    """Создает краткое описание дела"""
    parts = []

    if case_data.get("Суд"):
        parts.append(case_data["Суд"])

    if case_data.get("Истец") and case_data.get("Ответчик"):
        parts.append(f"{case_data['Истец']} vs {case_data['Ответчик']}")

    if case_data.get("Статус"):
        parts.append(f"Статус: {case_data['Статус']}")

    return "; ".join(parts) if parts else ""
