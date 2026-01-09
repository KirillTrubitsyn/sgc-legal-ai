"""
Consilium - Multi-model deliberation service
"""
import asyncio
import json
import re
from typing import List, Dict, Any, Optional, Callable, Awaitable
from datetime import datetime

from app.services.openrouter import chat_completion
from app.services.google_search import verify_case_with_google
from app.services.damia import verify_case_damia
from app.config import settings
import logging

logger = logging.getLogger(__name__)


# Модели консилиума
CONSILIUM_MODELS = {
    "chairman": "anthropic/claude-opus-4.5",
    "expert_1": "openai/gpt-5.2",
    "expert_2": "google/gemini-3-pro-preview",
    "verifier": "perplexity/sonar-pro-search"
}

MODEL_NAMES = {
    "anthropic/claude-opus-4.5": "Claude Opus 4.5",
    "openai/gpt-5.2": "ChatGPT 5.2",
    "google/gemini-3-pro-preview": "Gemini 3.0 Pro",
    "perplexity/sonar-pro-search": "Perplexity Sonar Pro"
}


async def run_consilium(
    question: str,
    on_stage_update: Optional[Callable[[str, str], Awaitable[None]]] = None
) -> Dict[str, Any]:
    """
    Запустить полный цикл консилиума
    """
    result = {
        "question": question,
        "started_at": datetime.utcnow().isoformat(),
        "stages": {},
        "final_answer": None,
        "verified_cases": [],
        "total_tokens": 0
    }

    # Стадия 1: Параллельный сбор мнений
    if on_stage_update:
        await on_stage_update("stage_1", "Сбор мнений экспертов...")

    opinions = await stage_1_gather_opinions(question)
    result["stages"]["stage_1"] = opinions

    # Стадия 2: Извлечение ссылок на судебную практику
    if on_stage_update:
        await on_stage_update("stage_2", "Извлечение судебной практики...")

    cases = await stage_2_extract_cases(opinions)
    result["stages"]["stage_2"] = cases

    # Стадия 3: Верификация судебных дел
    if on_stage_update:
        await on_stage_update("stage_3", "Верификация судебных дел...")

    verified = await stage_3_verify_cases(cases)
    result["stages"]["stage_3"] = verified
    result["verified_cases"] = [c for c in verified if c["status"] in ["VERIFIED", "LIKELY_EXISTS"]]

    # Стадия 4: Peer Review
    if on_stage_update:
        await on_stage_update("stage_4", "Взаимная оценка экспертов...")

    reviews = await stage_4_peer_review(question, opinions, verified)
    result["stages"]["stage_4"] = reviews

    # Стадия 5: Финальный синтез
    if on_stage_update:
        await on_stage_update("stage_5", "Формирование итогового ответа...")

    final = await stage_5_final_synthesis(question, opinions, verified, reviews)
    result["final_answer"] = final
    result["stages"]["stage_5"] = {"synthesis": final}

    result["completed_at"] = datetime.utcnow().isoformat()

    return result


async def stage_1_gather_opinions(question: str) -> Dict[str, Any]:
    """
    Стадия 1: Параллельный запрос ко всем моделям
    """
    system_prompt = """Вы — эксперт-юрист по российскому праву, составляющий аналитическую справку.

СТИЛЬ ИЗЛОЖЕНИЯ:
- Профессиональный юридический язык без эмоциональной окраски
- Убедительная аргументация через факты и логику
- Структура параграфа: тезис → аргументация → вывод
- Номера статей и пунктов пишите ТОЛЬКО цифрами (ст. 333 ГК РФ, п. 75)
- Сложные вопросы объясняйте доступно, избегая излишних канцеляризмов

СТРУКТУРА ОТВЕТА:
1. Существо вопроса — краткое изложение проблемы
2. Правовое регулирование — ссылки на статьи законов, кодексов РФ
3. Судебная практика — релевантные дела:
   - Номер дела (например, А40-12345/2024)
   - Суд и дата решения
   - Краткая суть позиции
4. Анализ и выводы — практические рекомендации
5. Риски (при наличии) — возможные правовые последствия

ФОРМАТИРОВАНИЕ:
- Используйте нумерованные разделы (1. 2. 3.)
- Прямые цитаты из судебных решений или НПА выделяйте курсивом: *цитата*
- Ключевые выводы выделяйте жирным: **вывод**
- НЕ используйте таблицы, символы #, ##, ###, |, ---

Отвечайте структурированно и по существу."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question}
    ]

    # Параллельные запросы
    tasks = []
    for role, model_id in CONSILIUM_MODELS.items():
        if role != "verifier":  # Verifier не участвует в первом раунде
            tasks.append(get_model_opinion(model_id, messages))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    opinions = {}
    model_list = [m for r, m in CONSILIUM_MODELS.items() if r != "verifier"]

    for model_id, res in zip(model_list, results):
        if isinstance(res, Exception):
            opinions[model_id] = {
                "model": model_id,
                "name": MODEL_NAMES.get(model_id, model_id),
                "content": f"Ошибка: {str(res)}",
                "error": True
            }
        else:
            opinions[model_id] = {
                "model": model_id,
                "name": MODEL_NAMES.get(model_id, model_id),
                "content": res["content"],
                "tokens": res.get("tokens", 0),
                "error": False
            }

    return opinions


async def get_model_opinion(model_id: str, messages: List[Dict]) -> Dict:
    """Получить ответ от конкретной модели"""
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: chat_completion(model_id, messages, stream=False, max_tokens=4096)
    )
    content = response["choices"][0]["message"]["content"]
    tokens = response.get("usage", {}).get("total_tokens", 0)
    return {"content": content, "tokens": tokens}


async def stage_2_extract_cases(opinions: Dict[str, Any]) -> List[Dict]:
    """
    Стадия 2: Извлечение ссылок на судебные дела
    """
    # Собираем все ответы
    all_opinions = "\n\n".join([
        f"=== {op['name']} ===\n{op['content']}"
        for op in opinions.values() if not op.get("error")
    ])

    extraction_prompt = """Проанализируй ответы экспертов и извлеки ВСЕ упоминания судебных дел.

Для каждого дела укажи в формате JSON:
{
  "cases": [
    {
      "case_number": "номер дела (например А40-12345/2024)",
      "court": "название суда",
      "date": "дата если указана",
      "summary": "краткая суть позиции",
      "source_model": "какая модель указала это дело"
    }
  ]
}

Если судебных дел не найдено, верни: {"cases": []}

Ответы экспертов:
""" + all_opinions

    messages = [
        {"role": "user", "content": extraction_prompt}
    ]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(CONSILIUM_MODELS["chairman"], messages, stream=False)
        )
        content = response["choices"][0]["message"]["content"]

        # Парсим JSON из ответа
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            return data.get("cases", [])
    except Exception as e:
        print(f"Error extracting cases: {e}")

    return []


async def stage_3_verify_cases(cases: List[Dict]) -> List[Dict]:
    """
    Стадия 3: Гибридная верификация судебных дел

    Порядок верификации:
    1. DaMIA API (приоритетный источник) - прямой доступ к базе арбитражных дел
    2. Если DaMIA не нашёл или ошибка -> fallback на Perplexity + Google Search

    verification_source в результате:
    - "damia_api" - подтверждено через DaMIA API
    - "perplexity_google" - подтверждено через Perplexity/Google (fallback)
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
                "summary": case_data.get("summary", ""),  # Саммари судебного решения
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

        # Шаг 2: DaMIA не нашёл или ошибка -> fallback на Perplexity + Google
        if damia_result.get("error"):
            logger.warning(f"DaMIA API error for {case_number}: {damia_result['error']}, falling back to Perplexity")
        else:
            logger.info(f"Case {case_number} not found in DaMIA, falling back to Perplexity + Google")

        # Параллельно запускаем проверку через Perplexity и Google
        perplexity_task = verify_with_perplexity(case_number)
        google_task = verify_case_with_google(case_number)

        perplexity_result, google_result = await asyncio.gather(
            perplexity_task,
            google_task,
            return_exceptions=True
        )

        # Обрабатываем результаты Perplexity
        perplexity_verification = {}
        if isinstance(perplexity_result, Exception):
            perplexity_verification = {"error": str(perplexity_result)}
        else:
            perplexity_verification = perplexity_result

        # Обрабатываем результаты Google
        google_verification = {}
        if isinstance(google_result, Exception):
            google_verification = {"error": str(google_result), "exists": False}
        else:
            google_verification = google_result

        # Комбинируем результаты для определения статуса
        combined_status, combined_verification = combine_verification_results(
            perplexity_verification,
            google_verification,
            case_number
        )

        # Добавляем информацию о DaMIA проверке
        combined_verification["damia_checked"] = True
        combined_verification["damia_error"] = damia_result.get("error")

        verified_cases.append({
            **case,
            "status": combined_status,
            "verification_source": "perplexity_google",
            "verification": combined_verification
        })

    return verified_cases


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

    return "; ".join(parts) if parts else ""


async def verify_with_perplexity(case_number: str) -> Dict:
    """
    Верификация через Perplexity Sonar Pro
    """
    verification_prompt = f"""Проверь существование судебного дела {case_number}.

Найди информацию об этом деле в открытых источниках (Судакт, КонсультантПлюс, Гарант, kad.arbitr.ru индексы).

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
            lambda: chat_completion(CONSILIUM_MODELS["verifier"], messages, stream=False)
        )
        content = response["choices"][0]["message"]["content"]

        json_match = re.search(r'\{[\s\S]*?\}', content)
        if json_match:
            return json.loads(json_match.group())
        else:
            return {"raw_response": content, "exists": False}

    except Exception as e:
        return {"error": str(e), "exists": False}


def combine_verification_results(
    perplexity: Dict,
    google: Dict,
    case_number: str
) -> tuple:
    """
    Комбинирует результаты верификации из двух источников

    Логика:
    - Если оба источника подтверждают (high confidence) -> VERIFIED
    - Если хотя бы один подтверждает с high -> VERIFIED
    - Если хотя бы один подтверждает -> LIKELY_EXISTS
    - Если ничего не найдено -> NOT_FOUND
    """
    perplexity_exists = perplexity.get("exists", False)
    perplexity_confidence = perplexity.get("confidence", "low")

    google_exists = google.get("exists", False)
    google_confidence = google.get("confidence", "low")

    # Собираем все источники
    all_sources = []
    all_links = []

    if perplexity.get("sources"):
        all_sources.extend(perplexity["sources"])
    if google.get("sources"):
        all_sources.extend(google["sources"])
    if google.get("links"):
        all_links.extend(google["links"])

    # Определяем статус
    status = "NOT_FOUND"

    if (perplexity_exists and perplexity_confidence == "high") or \
       (google_exists and google_confidence == "high"):
        status = "VERIFIED"
    elif (perplexity_exists and perplexity_confidence == "medium") or \
         (google_exists and google_confidence == "medium"):
        status = "VERIFIED"
    elif perplexity_exists or google_exists:
        status = "LIKELY_EXISTS"

    # Формируем комбинированный результат
    combined = {
        "exists": perplexity_exists or google_exists,
        "confidence": "high" if status == "VERIFIED" else ("medium" if status == "LIKELY_EXISTS" else "low"),
        "sources": list(set(all_sources)),  # Убираем дубликаты
        "links": all_links,
        "perplexity_result": perplexity,
        "google_result": google,
        "actual_info": perplexity.get("actual_info", "")
    }

    # Добавляем сниппеты из Google если есть
    if google.get("snippets"):
        combined["snippets"] = google["snippets"]

    return status, combined


async def stage_4_peer_review(
    question: str,
    opinions: Dict[str, Any],
    verified_cases: List[Dict]
) -> Dict[str, Any]:
    """
    Стадия 4: Взаимная оценка ответов
    """
    # Формируем информацию о верификации
    verification_summary = ""
    if verified_cases:
        verification_summary = "\n\nРезультаты верификации судебной практики:\n"
        for case in verified_cases:
            status_emoji = {
                "VERIFIED": "V",
                "LIKELY_EXISTS": "?",
                "NOT_FOUND": "X",
                "NEEDS_MANUAL_CHECK": "?"
            }.get(case.get("status"), "?")
            verification_summary += f"{status_emoji} {case.get('case_number')}: {case.get('status')}\n"

    review_prompt = f"""Оцени ответы экспертов на юридический вопрос.

ВОПРОС: {question}

ОТВЕТЫ ЭКСПЕРТОВ:
"""
    for op in opinions.values():
        if not op.get("error"):
            review_prompt += f"\n=== {op['name']} ===\n{op['content']}\n"

    review_prompt += verification_summary

    review_prompt += """

Оцени каждый ответ по критериям (1-10):
1. Правовая точность
2. Практическая применимость
3. Достоверность ссылок (с учётом верификации - вес 40%)
4. Качество аргументации

Ответь в формате JSON:
{
  "reviews": {
    "model_name": {
      "legal_accuracy": 8,
      "practical_value": 7,
      "source_reliability": 9,
      "argumentation": 8,
      "total": 8.0,
      "strengths": ["сильные стороны"],
      "weaknesses": ["слабые стороны"]
    }
  },
  "ranking": ["лучший", "второй", "третий"]
}"""

    messages = [{"role": "user", "content": review_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(CONSILIUM_MODELS["chairman"], messages, stream=False)
        )
        content = response["choices"][0]["message"]["content"]

        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"Error in peer review: {e}")

    return {"reviews": {}, "ranking": []}


async def stage_5_final_synthesis(
    question: str,
    opinions: Dict[str, Any],
    verified_cases: List[Dict],
    reviews: Dict[str, Any]
) -> str:
    """
    Стадия 5: Финальный синтез
    """
    # Только верифицированные дела
    valid_cases = [c for c in verified_cases if c.get("status") in ["VERIFIED", "LIKELY_EXISTS"]]

    synthesis_prompt = f"""Сформируй ИТОГОВЫЙ ОТВЕТ на юридический вопрос, объединив лучшие элементы ответов экспертов.

ВОПРОС: {question}

ОТВЕТЫ ЭКСПЕРТОВ:
"""
    for op in opinions.values():
        if not op.get("error"):
            synthesis_prompt += f"\n=== {op['name']} ===\n{op['content']}\n"

    synthesis_prompt += f"""

РЕЙТИНГ ЭКСПЕРТОВ: {reviews.get('ranking', [])}

ВЕРИФИЦИРОВАННАЯ СУДЕБНАЯ ПРАКТИКА (используй ТОЛЬКО эти дела):
"""
    if valid_cases:
        for case in valid_cases:
            synthesis_prompt += f"- {case.get('case_number')}: {case.get('summary', 'N/A')} [{case.get('status')}]\n"
    else:
        synthesis_prompt += "Верифицированных дел не найдено.\n"

    synthesis_prompt += """

ТРЕБОВАНИЯ К ИТОГОВОМУ ОТВЕТУ:
1. Объедини лучшие аргументы из всех ответов
2. Используй ТОЛЬКО верифицированную судебную практику
3. Структурируй ответ логически
4. Укажи практические рекомендации
5. Если есть расхождения между экспертами — отметь это

СТИЛЬ АНАЛИТИЧЕСКОЙ СПРАВКИ:
- Профессиональный юридический язык без эмоциональной окраски
- Убедительная аргументация через факты и логику
- Структура параграфа: тезис → аргументация → вывод
- Номера статей и пунктов пиши ТОЛЬКО цифрами (ст. 333 ГК РФ, п. 75)

СТРУКТУРА ОТВЕТА:
1. Существо вопроса — краткое изложение проблемы
2. Правовое регулирование — ссылки на НПА
3. Судебная практика — верифицированные дела
4. Анализ и выводы — практические рекомендации
5. Риски (при наличии) — возможные правовые последствия

ФОРМАТИРОВАНИЕ:
- Нумерованные разделы (1. 2. 3.)
- Прямые цитаты курсивом: *цитата*
- Ключевые выводы жирным: **вывод**
- НЕ используй таблицы, символы #, ##, ###, |, ---

Дай полный, структурированный ответ:"""

    messages = [{"role": "user", "content": synthesis_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(CONSILIUM_MODELS["chairman"], messages, stream=False, max_tokens=4096)
        )
        return response["choices"][0]["message"]["content"]
    except Exception as e:
        return f"Ошибка синтеза: {str(e)}"
