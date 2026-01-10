"""
Consilium - Multi-model deliberation service
"""
import asyncio
import json
import re
from typing import List, Dict, Any, Optional, Callable, Awaitable
from datetime import datetime

from app.services.openrouter import chat_completion
from app.config import settings
import logging

logger = logging.getLogger(__name__)


def clean_markdown(text: str) -> str:
    """
    Удаляет маркдаун-разметку из текста для чистого отображения.
    """
    if not text:
        return text

    # Удаляем "ПРАВОВОЕ ЗАКЛЮЧЕНИЕ" в начале
    text = re.sub(r'^[\s\n]*ПРАВОВОЕ ЗАКЛЮЧЕНИЕ[\s\n]*', '', text, flags=re.IGNORECASE)

    # Удаляем "Председатель консилиума" и подобные подписи
    text = re.sub(r'^Председатель\s+(юридического\s+)?консилиума.*$', '', text, flags=re.MULTILINE | re.IGNORECASE)

    # Удаляем "Дата составления заключения"
    text = re.sub(r'^Дата составления заключения.*$', '', text, flags=re.MULTILINE | re.IGNORECASE)

    # Удаляем заголовки #### ### ## #
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)

    # Удаляем **bold** и *italic*
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
    text = re.sub(r'\*([^*]+)\*', r'\1', text)

    # Удаляем __bold__ и _italic_
    text = re.sub(r'__([^_]+)__', r'\1', text)
    text = re.sub(r'_([^_]+)_', r'\1', text)

    # Удаляем ``` блоки кода
    text = re.sub(r'```[^`]*```', '', text, flags=re.DOTALL)

    # Удаляем `inline code`
    text = re.sub(r'`([^`]+)`', r'\1', text)

    # Удаляем горизонтальные линии
    text = re.sub(r'^---+$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\*\*\*+$', '', text, flags=re.MULTILINE)

    # Удаляем лишние пустые строки
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


# Модели консилиума (3-этапная схема с параллельным поиском)
CONSILIUM_MODELS = {
    # Этап 1: Эксперты (отвечают на вопрос)
    "chairman": "anthropic/claude-opus-4.5",
    "expert_1": "openai/gpt-5.2-chat",
    "expert_2": "google/gemini-3-pro-preview",
    # Этап 1: Поисковик (ищет судебную практику параллельно)
    "searcher": "perplexity/sonar-pro-search",
    # Этап 2: Peer Review
    "reviewer": "anthropic/claude-sonnet-4.5",
    # Этап 3: Синтез (chairman)
}

MODEL_NAMES = {
    "anthropic/claude-opus-4.5": "Claude Opus 4.5",
    "openai/gpt-5.2-chat": "GPT-5.2",
    "google/gemini-3-pro-preview": "Gemini 3 Pro Preview",
    "perplexity/sonar-pro-search": "Perplexity (Поиск)",
    "anthropic/claude-sonnet-4.5": "Claude Sonnet 4.5"
}


async def run_consilium(
    question: str,
    on_stage_update: Optional[Callable[[str, str], Awaitable[None]]] = None
) -> Dict[str, Any]:
    """
    Запустить полный цикл консилиума (3-этапная схема с параллельным поиском)

    Этап 1: ПАРАЛЛЕЛЬНО:
            - 3 эксперта (Opus + GPT + Gemini) отвечают на вопрос
            - Perplexity ищет судебную практику
    Этап 2: Peer Review (Sonnet) - оценка экспертов с учётом найденной практики
    Этап 3: Синтез (Opus) - финальное заключение с верифицированной практикой
    """
    result = {
        "question": question,
        "started_at": datetime.utcnow().isoformat(),
        "stages": {},
        "final_answer": None,
        "verified_cases": [],
        "total_tokens": 0
    }

    # Стадия 1: Параллельно - эксперты отвечают + Perplexity ищет практику
    if on_stage_update:
        await on_stage_update("stage_1", "Сбор мнений экспертов и поиск судебной практики...")

    opinions, search_results = await stage_1_parallel_gather(question)
    result["stages"]["stage_1"] = opinions
    result["stages"]["search"] = search_results  # Результаты поиска Perplexity

    # Стадия 2: Peer Review с учётом найденной практики
    if on_stage_update:
        await on_stage_update("stage_2", "Анализ и оценка экспертов...")

    review_data = await stage_2_peer_review(question, opinions, search_results)
    result["stages"]["stage_2"] = review_data.get("cases", [])
    result["stages"]["stage_4"] = review_data.get("reviews", {})
    result["verified_cases"] = review_data.get("cases", [])

    # Стадия 3: Финальный синтез с верифицированной практикой
    if on_stage_update:
        await on_stage_update("stage_3", "Формирование итогового ответа...")

    final = await stage_3_final_synthesis(question, opinions, review_data, search_results)
    result["final_answer"] = final
    result["stages"]["stage_5"] = {"synthesis": final}

    result["completed_at"] = datetime.utcnow().isoformat()

    return result


async def stage_1_parallel_gather(question: str) -> tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Стадия 1: ПАРАЛЛЕЛЬНЫЙ сбор мнений экспертов + поиск судебной практики

    Эксперты (Opus, GPT, Gemini) отвечают на юридический вопрос
    Perplexity параллельно ищет релевантную судебную практику в интернете
    """
    # Промпт для экспертов (юридическое заключение)
    expert_system_prompt = """Вы — эксперт-юрист по российскому праву, составляющий правовое заключение.

СТРУКТУРА ОТВЕТА:
1. Краткий ответ (1-2 абзаца)
2. Правовое обоснование:
   - Применимые нормы права
   - Анализ правоотношений
3. Практические рекомендации

СТИЛЬ:
- Академический юридический язык
- Ссылки на статьи: ст. 333 ГК РФ
- НЕ используйте #, ##, таблицы"""

    expert_messages = [
        {"role": "system", "content": expert_system_prompt},
        {"role": "user", "content": question}
    ]

    # Промпт для Perplexity (поиск судебной практики)
    search_prompt = f"""Найди в интернете РЕАЛЬНУЮ судебную практику по следующему юридическому вопросу:

ВОПРОС: {question}

ЗАДАЧА: Найди конкретные судебные дела (решения судов РФ) по этой теме.

Для каждого найденного дела укажи:
1. Номер дела (например: А40-12345/2024, 88-1234/2023)
2. Суд (например: Арбитражный суд г. Москвы, ВС РФ)
3. Дата решения
4. Суть правовой позиции суда
5. Источник (ссылка на kad.arbitr.ru, consultant.ru, sudact.ru и т.д.)

ВАЖНО:
- Ищи ТОЛЬКО реальные дела с реальными номерами
- Приводи ссылки на источники
- Если не нашёл релевантных дел — так и напиши

Ответь структурированно, перечисляя найденные дела."""

    search_messages = [{"role": "user", "content": search_prompt}]

    # Запускаем ПАРАЛЛЕЛЬНО: 3 эксперта + 1 поисковик
    expert_roles = ["chairman", "expert_1", "expert_2"]
    tasks = []

    # Задачи экспертов
    for role in expert_roles:
        model_id = CONSILIUM_MODELS[role]
        tasks.append(get_model_opinion(model_id, expert_messages))

    # Задача поисковика (Perplexity)
    tasks.append(get_search_results(CONSILIUM_MODELS["searcher"], search_messages))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Разбираем результаты экспертов (первые 3)
    opinions = {}
    model_list = [CONSILIUM_MODELS[role] for role in expert_roles]

    for model_id, res in zip(model_list, results[:3]):
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

    # Разбираем результат поиска (последний)
    search_result = results[3]
    if isinstance(search_result, Exception):
        search_results = {
            "content": f"Ошибка поиска: {str(search_result)}",
            "cases": [],
            "error": True
        }
    else:
        search_results = {
            "content": search_result["content"],
            "tokens": search_result.get("tokens", 0),
            "error": False
        }

    return opinions, search_results


async def get_search_results(model_id: str, messages: List[Dict]) -> Dict:
    """Получить результаты поиска от Perplexity"""
    loop = asyncio.get_event_loop()
    response = await loop.run_in_executor(
        None,
        lambda: chat_completion(model_id, messages, stream=False, max_tokens=4096)
    )
    content = response["choices"][0]["message"]["content"]
    tokens = response.get("usage", {}).get("total_tokens", 0)
    return {"content": content, "tokens": tokens}


async def get_model_opinion(model_id: str, messages: List[Dict]) -> Dict:
    """Получить ответ от конкретной модели с поддержкой reasoning"""
    loop = asyncio.get_event_loop()

    # Включаем reasoning для thinking-моделей
    reasoning_effort = None
    if "gpt-5" in model_id or "claude-opus" in model_id:
        reasoning_effort = "high"

    response = await loop.run_in_executor(
        None,
        lambda: chat_completion(
            model_id, messages,
            stream=False,
            max_tokens=8192,
            reasoning_effort=reasoning_effort
        )
    )
    content = response["choices"][0]["message"]["content"]
    tokens = response.get("usage", {}).get("total_tokens", 0)
    return {"content": content, "tokens": tokens}


async def stage_2_peer_review(question: str, opinions: Dict[str, Any], search_results: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Стадия 2: Peer Review (Claude Sonnet 4.5)
    - Оценка каждого эксперта по критериям
    - Объединение с результатами поиска Perplexity
    """
    # Собираем ответы экспертов (полные ответы без ограничения)
    all_opinions = "\n\n".join([
        f"=== {op['name']} ===\n{op['content']}"
        for op in opinions.values() if not op.get("error")
    ])

    # Добавляем результаты поиска Perplexity
    search_content = ""
    if search_results and not search_results.get("error"):
        search_content = f"""

=== РЕЗУЛЬТАТЫ ПОИСКА СУДЕБНОЙ ПРАКТИКИ (Perplexity) ===
{search_results.get('content', 'Нет данных')}
"""

    review_prompt = f"""Проанализируй ответы экспертов и результаты поиска судебной практики.

ВОПРОС: {question}

ОТВЕТЫ ЭКСПЕРТОВ:
{all_opinions}
{search_content}

ЗАДАЧИ:

1. Оцени каждого эксперта по критериям (1-10):
   - Правовая точность
   - Практическая применимость
   - Качество аргументации

2. Составь список ВЕРИФИЦИРОВАННЫХ судебных дел:
   - Приоритет делам из поиска Perplexity (они найдены в интернете)
   - Дела от экспертов помечай как "требует проверки"

Ответь в формате JSON:
{{
  "reviews": {{
    "Claude Opus 4.5": {{
      "legal_accuracy": 8,
      "practical_value": 7,
      "argumentation": 8,
      "total": 7.7,
      "strengths": ["..."],
      "weaknesses": ["..."]
    }},
    "GPT-5.2": {{ ... }},
    "Gemini 3 Pro Preview": {{ ... }}
  }},
  "ranking": ["лучший", "второй", "третий"],
  "cases": [
    {{
      "case_number": "А40-12345/2024",
      "court": "суд",
      "summary": "суть позиции",
      "source": "perplexity или expert",
      "status": "VERIFIED" или "NEEDS_CHECK",
      "url": "ссылка если есть"
    }}
  ]
}}"""

    messages = [{"role": "user", "content": review_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(CONSILIUM_MODELS["reviewer"], messages, stream=False, max_tokens=4096)
        )
        content = response["choices"][0]["message"]["content"]

        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            return {
                "reviews": data.get("reviews", {}),
                "ranking": data.get("ranking", []),
                "cases": data.get("cases", [])
            }
    except Exception as e:
        logger.error(f"Error in peer review: {e}")

    return {"reviews": {}, "ranking": [], "cases": []}


async def stage_3_final_synthesis(
    question: str,
    opinions: Dict[str, Any],
    review_data: Dict[str, Any],
    search_results: Dict[str, Any] = None
) -> str:
    """
    Стадия 3: Финальный синтез (Claude Opus 4.5)
    Создаёт единое заключение с верифицированной судебной практикой
    """
    cases = review_data.get("cases", [])
    reviews = review_data.get("reviews", {})
    ranking = review_data.get("ranking", [])

    # Добавляем результаты поиска Perplexity
    search_content = ""
    if search_results and not search_results.get("error"):
        search_content = search_results.get("content", "")

    synthesis_prompt = f"""Ты — председатель юридического консилиума. Твоя задача — создать ЕДИНОЕ итоговое правовое заключение на основе мнений 3 экспертов и найденной судебной практики.

КРИТИЧЕСКИ ВАЖНО:
- НЕ КОПИРУЙ ответы экспертов дословно
- НЕ СОЗДАВАЙ отдельные разделы для каждого эксперта
- СИНТЕЗИРУЙ мнения в ОДИН связный документ
- Каждый раздел (нормативная база, судебная практика и т.д.) должен быть ОДИН, а не повторяться несколько раз
- Используй НАЙДЕННУЮ судебную практику с реальными ссылками

ВОПРОС КЛИЕНТА: {question}

МНЕНИЯ ЭКСПЕРТОВ (используй как источник, НЕ копируй):
"""
    for op in opinions.values():
        if not op.get("error"):
            synthesis_prompt += f"\n--- {op['name']} ---\n{op['content']}\n"

    synthesis_prompt += f"""

РЕЙТИНГ ЭКСПЕРТОВ: {ranking}

=== НАЙДЕННАЯ СУДЕБНАЯ ПРАКТИКА (Perplexity Search) ===
{search_content if search_content else "Результаты поиска недоступны."}

=== ВЕРИФИЦИРОВАННЫЕ ДЕЛА (из анализа) ===
"""
    if cases:
        for case in cases:
            url = case.get('url', '')
            status = case.get('status', 'N/A')
            synthesis_prompt += f"- {case.get('case_number')}: {case.get('summary', 'N/A')} [{status}]"
            if url:
                synthesis_prompt += f" URL: {url}"
            synthesis_prompt += "\n"
    else:
        synthesis_prompt += "Не найдено.\n"

    synthesis_prompt += """

ТВОЯ ЗАДАЧА — написать ЕДИНОЕ заключение.

ВАЖНО - ФОРМАТ:
1. Начинай СРАЗУ с темы исследования: "по вопросу о..." (без заголовков "ПРАВОВОЕ ЗАКЛЮЧЕНИЕ" и т.п.)
2. НЕ добавляй в конце "Председатель консилиума", подписи, даты составления
3. Заканчивай практическими рекомендациями

СТРУКТУРА:

по вопросу о [тема из вопроса клиента]: теоретические подходы и нерешённые проблемы

A. КРАТКИЙ ОТВЕТ
   Резюме: что отвечать клиенту кратко (2-3 абзаца)

B. ПРАВОВОЕ ОБОСНОВАНИЕ
   Применимые нормы права
   - Нормативная база (статьи кодексов)
   - Анализ правоотношений
   - Ключевые правовые выводы

C. СУДЕБНАЯ ПРАКТИКА
   - Релевантные дела
   - Правовые позиции судов

D. ПРАКТИЧЕСКИЕ РЕКОМЕНДАЦИИ
   - Конкретные действия для клиента
   - Риски и способы их минимизации

ПРАВИЛА СИНТЕЗА:
1. Если эксперты согласны — изложи консенсусную позицию
2. Если эксперты расходятся — укажи обе позиции и выбери обоснованную
3. Бери ЛУЧШИЕ аргументы от каждого эксперта, не все подряд
4. Удаляй дублирование — одна мысль = одно упоминание

СТИЛЬ:
- Академический юридический язык
- Ссылки на статьи: ст. 333 ГК РФ
- Заголовки разделов (A., B., C., D.) - отдельной строкой
- НЕ используй #, ##, таблицы

Напиши ЕДИНОЕ, СВЯЗНОЕ заключение:"""

    messages = [{"role": "user", "content": synthesis_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(
                CONSILIUM_MODELS["chairman"], messages,
                stream=False,
                max_tokens=8192,
                reasoning_effort="high"
            )
        )
        raw_content = response["choices"][0]["message"]["content"]
        return clean_markdown(raw_content)
    except Exception as e:
        return f"Ошибка синтеза: {str(e)}"


# ============================================
# LEGACY FUNCTIONS (kept for compatibility)
# ============================================

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
    Стадия 3: Верификация судебных дел через Perplexity Sonar Pro
    """
    if not cases:
        return []

    verified_cases = []

    for case in cases:
        case_number = case.get("case_number", "")
        if not case_number:
            continue

        # Проверяем через Perplexity
        try:
            perplexity_result = await verify_with_perplexity(case_number)
        except Exception as e:
            logger.error(f"Perplexity verification error for {case_number}: {e}")
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
                "actual_info": perplexity_result.get("actual_info", "")
            }
        })

    return verified_cases


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

    synthesis_prompt = f"""Сформируй ИТОГОВОЕ ПРАВОВОЕ ЗАКЛЮЧЕНИЕ, объединив лучшие элементы ответов экспертов консилиума.

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

СТРУКТУРА ИТОГОВОГО ЗАКЛЮЧЕНИЯ:

1. **Краткие ответы** — резюме выводов (1–2 абзаца)

2. **Развёрнутый анализ** по разделам A, B, C...:
   - Заголовок раздела = тезис («Договор подлежит расторжению»)
   - Теоретическое обоснование (доктрина)
   - Нормативная база (статьи кодексов)
   - Судебная практика (ТОЛЬКО верифицированные дела)
   - Промежуточный вывод

3. **Итоговые выводы** — практические рекомендации

МЕТОДОЛОГИЯ:

1. Многоуровневая защита каждого тезиса:
   - Основной аргумент
   - Субсидиарный («Даже если считать, что..., то...»)
   - Запасной аргумент

2. При расхождении экспертов:
   - Изложи обе позиции объективно
   - Укажи преобладающую точку зрения
   - Обоснуй выбор итоговой позиции

ПРАВИЛА РАБОТЫ С СУДЕБНОЙ ПРАКТИКОЙ:

- Используй ТОЛЬКО дела со статусом VERIFIED
- Указывай: номер дела, суд, суть правовой позиции
- Не выдумывай номера — только из списка выше
- Дела LIKELY_EXISTS упоминай с оговоркой о необходимости проверки

СТИЛИСТИКА:

- Академический юридический язык
- Латинские термины курсивом: *pacta sunt servanda*, *lex specialis*
- Предложения не более 35 слов
- Номера статей цифрами: ст. 333 ГК РФ
- **Ключевые выводы** — жирным
- *Цитаты из судебных актов* — курсивом

ФОРМАТИРОВАНИЕ:

- Иерархическая нумерация: A, B, C → 1, 2, 3
- Заголовки = тезисы (не темы)
- НЕ используй таблицы и символы #, ##, ###
- Буллеты только для перечисления однородных элементов

Дай полное, глубокое правовое заключение академического уровня:"""

    messages = [{"role": "user", "content": synthesis_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(CONSILIUM_MODELS["chairman"], messages, stream=False, max_tokens=8192)
        )
        raw_content = response["choices"][0]["message"]["content"]
        # Очищаем маркдаун из ответа
        return clean_markdown(raw_content)
    except Exception as e:
        return f"Ошибка синтеза: {str(e)}"
