"""
DaMIA API Service - верификация судебных дел через API DaMIA
https://api.damia.ru/arb/delo
"""
import httpx
import logging
from typing import Dict, Any, Optional

from app.config import settings

logger = logging.getLogger(__name__)

DAMIA_API_URL = "https://api.damia.ru/arb/delo"
DAMIA_TIMEOUT = 10.0  # секунд


async def verify_case_damia(case_number: str) -> Dict[str, Any]:
    """
    Верификация судебного дела через DaMIA API.

    Args:
        case_number: Номер дела (например, А40-12345/2024)

    Returns:
        {
            "exists": bool,
            "case_data": dict | None,
            "error": str | None
        }
    """
    if not settings.damia_api_key:
        logger.warning("DaMIA API key not configured")
        return {
            "exists": False,
            "case_data": None,
            "error": "DaMIA API key not configured"
        }

    # Нормализуем номер дела (убираем лишние пробелы)
    normalized_case_number = case_number.strip()

    try:
        async with httpx.AsyncClient(timeout=DAMIA_TIMEOUT) as client:
            response = await client.get(
                DAMIA_API_URL,
                params={
                    "regn": normalized_case_number,
                    "key": settings.damia_api_key
                }
            )

            if response.status_code == 200:
                data = response.json()
                return _parse_damia_response(data, normalized_case_number)
            elif response.status_code == 404:
                logger.info(f"DaMIA: case {normalized_case_number} not found")
                return {
                    "exists": False,
                    "case_data": None,
                    "error": None
                }
            else:
                error_msg = f"DaMIA API error: HTTP {response.status_code}"
                logger.error(f"{error_msg} for case {normalized_case_number}")
                return {
                    "exists": False,
                    "case_data": None,
                    "error": error_msg
                }

    except httpx.TimeoutException:
        logger.error(f"DaMIA API timeout for case {normalized_case_number}")
        return {
            "exists": False,
            "case_data": None,
            "error": "DaMIA API timeout"
        }
    except httpx.RequestError as e:
        logger.error(f"DaMIA API request error for case {normalized_case_number}: {e}")
        return {
            "exists": False,
            "case_data": None,
            "error": f"Request error: {str(e)}"
        }
    except Exception as e:
        logger.error(f"DaMIA API unexpected error for case {normalized_case_number}: {e}")
        return {
            "exists": False,
            "case_data": None,
            "error": f"Unexpected error: {str(e)}"
        }


def _parse_damia_response(data: Any, case_number: str) -> Dict[str, Any]:
    """
    Парсит ответ от DaMIA API.

    Поля ответа:
    - РегНомер: регистрационный номер дела
    - Суд: название суда
    - Дата: дата решения
    - Тип: тип дела
    - Статус: статус дела
    - Url: ссылка на дело
    - Сумма: сумма иска
    - Судья: имя судьи
    - Истец / Заявитель: истец по делу
    - Ответчик: ответчик по делу
    - Предмет / Категория: предмет спора
    - Описание / Результат: описание или результат дела
    """
    # Если ответ пустой или не содержит данных
    if not data:
        return {
            "exists": False,
            "case_data": None,
            "error": None
        }

    # DaMIA может возвращать список дел или одно дело
    # Ищем совпадение по номеру дела
    cases = data if isinstance(data, list) else [data]

    for case in cases:
        if not isinstance(case, dict):
            continue

        # Проверяем, что дело найдено по номеру
        reg_number = case.get("РегНомер", "")

        # Нормализуем для сравнения (игнорируем регистр и пробелы)
        if _normalize_case_number(reg_number) == _normalize_case_number(case_number):
            # Парсим все доступные поля
            case_data = {
                "reg_number": case.get("РегНомер"),
                "court": case.get("Суд"),
                "date": case.get("Дата"),
                "case_type": case.get("Тип"),
                "status": case.get("Статус"),
                "url": case.get("Url"),
                "amount": case.get("Сумма"),
                "judge": case.get("Судья"),
                # Дополнительные поля для саммари
                "plaintiff": case.get("Истец") or case.get("Заявитель"),
                "defendant": case.get("Ответчик"),
                "subject": case.get("Предмет") or case.get("Категория"),
                "description": case.get("Описание") or case.get("Результат"),
                "raw_data": case  # Сохраняем исходные данные на всякий случай
            }

            # Генерируем саммари из доступных данных
            case_data["summary"] = _generate_case_summary(case_data)

            logger.info(f"DaMIA: case {case_number} VERIFIED")
            return {
                "exists": True,
                "case_data": case_data,
                "error": None
            }

    # Дело не найдено в ответе
    logger.info(f"DaMIA: case {case_number} not found in response")
    return {
        "exists": False,
        "case_data": None,
        "error": None
    }


def _generate_case_summary(case_data: Dict) -> str:
    """
    Генерирует краткое саммари судебного дела из доступных данных.
    """
    parts = []

    # Тип дела
    if case_data.get("case_type"):
        parts.append(f"Тип: {case_data['case_type']}")

    # Стороны дела
    if case_data.get("plaintiff") and case_data.get("defendant"):
        parts.append(f"{case_data['plaintiff']} vs {case_data['defendant']}")
    elif case_data.get("plaintiff"):
        parts.append(f"Истец: {case_data['plaintiff']}")
    elif case_data.get("defendant"):
        parts.append(f"Ответчик: {case_data['defendant']}")

    # Предмет спора
    if case_data.get("subject"):
        parts.append(f"Предмет: {case_data['subject']}")

    # Сумма иска
    if case_data.get("amount"):
        parts.append(f"Сумма: {case_data['amount']}")

    # Суд и судья
    court_info = []
    if case_data.get("court"):
        court_info.append(case_data["court"])
    if case_data.get("judge"):
        court_info.append(f"судья {case_data['judge']}")
    if court_info:
        parts.append(", ".join(court_info))

    # Дата и статус
    if case_data.get("date"):
        parts.append(f"Дата: {case_data['date']}")
    if case_data.get("status"):
        parts.append(f"Статус: {case_data['status']}")

    # Описание/результат если есть
    if case_data.get("description"):
        parts.append(f"Результат: {case_data['description']}")

    return ". ".join(parts) if parts else "Информация о деле получена из kad.arbitr.ru"


def _normalize_case_number(case_number: str) -> str:
    """
    Нормализует номер дела для сравнения.
    Убирает пробелы, приводит к нижнему регистру.
    """
    if not case_number:
        return ""
    return case_number.strip().lower().replace(" ", "")
