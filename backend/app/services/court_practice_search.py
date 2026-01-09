"""
Court Practice Search Service - поиск и верификация судебной практики для Single Mode
"""
import asyncio
import json
import re
from typing import List, Dict, Any, Optional, Callable, Awaitable
from datetime import datetime

from app.services.openrouter import chat_completion
from app.services.damia import verify_case_damia
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Модели для поиска
SEARCH_MODEL = "perplexity/sonar-pro-search"
EXTRACTION_MODEL = "anthropic/claude-opus-4.5"


async def search_court_practice(
    query: str,
    on_stage_update: Optional[Callable[[str, str], Awaitable[None]]] = None
) -> Dict[str, Any]:
    """
    Поиск судебной практики по запросу с верификацией через DaMIA.

    Args:
        query: Поисковый запрос (тема или вопрос)
        on_stage_update: Callback для обновления статуса (stage, message)

    Returns:
        {
            "query": str,
            "started_at": str,
            "completed_at": str,
            "search_result": str,  # Текст от Perplexity
            "cases": [...],  # Извлеченные дела
            "verified_cases": [...],  # Верифицированные дела
            "summary": str  # Краткое резюме
        }
    """
    result = {
        "query": query,
        "started_at": datetime.utcnow().isoformat(),
        "search_result": "",
        "cases": [],
        "verified_cases": [],
        "summary": ""
    }

    # Стадия 1: Поиск через Perplexity
    if on_stage_update:
        await on_stage_update("search", "Поиск судебной практики...")

    search_result = await _search_with_perplexity(query)
    result["search_result"] = search_result

    # Стадия 2: Извлечение номеров дел
    if on_stage_update:
        await on_stage_update("extract", "Извлечение номеров дел...")

    cases = await _extract_case_numbers(search_result)
    result["cases"] = cases

    if not cases:
        result["completed_at"] = datetime.utcnow().isoformat()
        result["summary"] = "Конкретные номера судебных дел не найдены в результатах поиска."
        return result

    # Стадия 3: Верификация через DaMIA
    if on_stage_update:
        await on_stage_update("verify", f"Верификация {len(cases)} дел через DaMIA...")

    verified_cases = await _verify_cases(cases)
    result["verified_cases"] = verified_cases

    # Формируем резюме
    verified_count = len([c for c in verified_cases if c["status"] == "VERIFIED"])
    likely_count = len([c for c in verified_cases if c["status"] == "LIKELY_EXISTS"])
    not_found_count = len([c for c in verified_cases if c["status"] == "NOT_FOUND"])

    result["summary"] = f"Найдено {len(cases)} дел. Верифицировано: {verified_count}, вероятно существуют: {likely_count}, не найдено: {not_found_count}."
    result["completed_at"] = datetime.utcnow().isoformat()

    if on_stage_update:
        await on_stage_update("complete", result["summary"])

    return result


async def _search_with_perplexity(query: str) -> str:
    """
    Поиск судебной практики через Perplexity Sonar Pro
    """
    search_prompt = f"""Найди актуальную судебную практику по теме: {query}

ПРИОРИТЕТНЫЕ ИСТОЧНИКИ:
- kad.arbitr.ru - Картотека арбитражных дел
- sudact.ru - Судебные акты РФ
- vsrf.ru - Верховный Суд РФ
- consultant.ru - КонсультантПлюс
- garant.ru - Гарант

ДЛЯ КАЖДОГО НАЙДЕННОГО ДЕЛА ОБЯЗАТЕЛЬНО УКАЖИ:
1. Номер дела (например: А40-12345/2024, 88-1234/2023)
2. Название суда
3. Дата решения
4. Краткая суть позиции суда
5. Ссылка на источник (если есть)

Также укажи релевантные статьи законов и кодексов РФ.
Приведи минимум 3-5 конкретных судебных дел с номерами."""

    messages = [{"role": "user", "content": search_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(SEARCH_MODEL, messages, stream=False, max_tokens=4096)
        )
        return response["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Perplexity search error: {e}")
        return f"Ошибка поиска: {str(e)}"


async def _extract_case_numbers(search_result: str) -> List[Dict]:
    """
    Извлечение номеров судебных дел из текста результатов поиска
    """
    extraction_prompt = f"""Проанализируй текст и извлеки ВСЕ упоминания судебных дел.

ТЕКСТ:
{search_result}

Для каждого найденного дела укажи в формате JSON:
{{
  "cases": [
    {{
      "case_number": "номер дела (например А40-12345/2024, 88-1234/2023)",
      "court": "название суда",
      "date": "дата решения если указана",
      "summary": "краткая суть позиции суда"
    }}
  ]
}}

ВАЖНО:
- Извлекай только реальные номера дел из текста
- Номера арбитражных дел обычно начинаются с А + цифра региона (А40, А60, А56 и т.д.)
- Номера кассационных дел могут быть в формате 88-1234/2023
- Номера апелляционных дел в формате 13АП-12345/2023 или 09АП-12345/2023
- Если дел не найдено, верни {{"cases": []}}"""

    messages = [{"role": "user", "content": extraction_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(EXTRACTION_MODEL, messages, stream=False)
        )
        content = response["choices"][0]["message"]["content"]

        # Парсим JSON
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            cases = data.get("cases", [])

            # Дедупликация по номеру дела
            seen = set()
            unique_cases = []
            for case in cases:
                case_num = case.get("case_number", "").strip().upper()
                if case_num and case_num not in seen:
                    seen.add(case_num)
                    unique_cases.append(case)

            return unique_cases
    except Exception as e:
        logger.error(f"Case extraction error: {e}")

    return []


async def _verify_cases(cases: List[Dict]) -> List[Dict]:
    """
    Верификация судебных дел через DaMIA API с fallback на Perplexity
    """
    if not cases:
        return []

    verified_cases = []

    for case in cases:
        case_number = case.get("case_number", "")
        if not case_number:
            continue

        # Шаг 1: Проверяем через DaMIA API
        damia_result = await verify_case_damia(case_number)

        if damia_result.get("exists"):
            # DaMIA подтвердил существование дела
            logger.info(f"Case {case_number} verified via DaMIA API")

            case_data = damia_result.get("case_data", {})
            verified_cases.append({
                **case,
                "status": "VERIFIED",
                "verification_source": "damia_api",
                "verification": {
                    "exists": True,
                    "confidence": "high",
                    "sources": ["DaMIA API (kad.arbitr.ru)"],
                    "links": [case_data.get("url")] if case_data.get("url") else [],
                    "damia_data": case_data,
                    "actual_info": _format_damia_info(case_data)
                }
            })
            continue

        # Шаг 2: DaMIA не нашёл -> fallback на Perplexity
        if damia_result.get("error"):
            logger.warning(f"DaMIA API error for {case_number}: {damia_result['error']}, falling back to Perplexity")
        else:
            logger.info(f"Case {case_number} not found in DaMIA, falling back to Perplexity")

        # Проверяем через Perplexity
        try:
            perplexity_result = await _verify_with_perplexity(case_number)
        except Exception as e:
            perplexity_result = {"error": str(e), "exists": False}

        # Определяем статус на основе Perplexity
        perplexity_exists = perplexity_result.get("exists", False)
        perplexity_confidence = perplexity_result.get("confidence", "low")

        if perplexity_exists and perplexity_confidence in ["high", "medium"]:
            status = "VERIFIED"
        elif perplexity_exists:
            status = "LIKELY_EXISTS"
        else:
            status = "NOT_FOUND"

        verified_cases.append({
            **case,
            "status": status,
            "verification_source": "perplexity",
            "verification": {
                "exists": perplexity_exists,
                "confidence": perplexity_confidence,
                "sources": perplexity_result.get("sources", []),
                "actual_info": perplexity_result.get("actual_info", ""),
                "damia_checked": True,
                "damia_error": damia_result.get("error")
            }
        })

    return verified_cases


async def _verify_with_perplexity(case_number: str) -> Dict:
    """
    Верификация через Perplexity Sonar Pro
    """
    verification_prompt = f"""Проверь существование судебного дела {case_number}.

Найди информацию об этом деле в открытых источниках (kad.arbitr.ru, sudact.ru, consultant.ru, garant.ru).

Ответь в формате JSON:
{{
  "exists": true/false,
  "confidence": "high"/"medium"/"low",
  "sources": ["список источников где найдено"],
  "actual_info": "краткая информация о деле если найдено"
}}"""

    messages = [{"role": "user", "content": verification_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(SEARCH_MODEL, messages, stream=False)
        )
        content = response["choices"][0]["message"]["content"]

        json_match = re.search(r'\{[\s\S]*?\}', content)
        if json_match:
            return json.loads(json_match.group())
        else:
            return {"raw_response": content, "exists": False}

    except Exception as e:
        return {"error": str(e), "exists": False}


def _format_damia_info(case_data: Dict) -> str:
    """Форматирует информацию из DaMIA для отображения"""
    if not case_data:
        return ""

    parts = []
    if case_data.get("court"):
        parts.append(f"Суд: {case_data['court']}")
    if case_data.get("date"):
        parts.append(f"Дата: {case_data['date']}")
    if case_data.get("status"):
        parts.append(f"Статус: {case_data['status']}")
    if case_data.get("judge"):
        parts.append(f"Судья: {case_data['judge']}")
    if case_data.get("amount"):
        parts.append(f"Сумма: {case_data['amount']}")
    if case_data.get("plaintiff"):
        parts.append(f"Истец: {case_data['plaintiff']}")
    if case_data.get("defendant"):
        parts.append(f"Ответчик: {case_data['defendant']}")

    return "; ".join(parts) if parts else ""
