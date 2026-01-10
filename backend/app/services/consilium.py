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


# Модели консилиума (3-этапная схема)
CONSILIUM_MODELS = {
    # Этап 1: Сбор мнений (все 4 эксперта)
    "chairman": "anthropic/claude-opus-4.5",
    "expert_1": "openai/gpt-5.2",
    "expert_2": "google/gemini-3-pro-preview",
    "expert_3": "perplexity/sonar-pro-search",
    # Этап 2: Peer Review
    "reviewer": "anthropic/claude-sonnet-4",
    # Этап 3: Синтез (chairman)
}

MODEL_NAMES = {
    "anthropic/claude-opus-4.5": "Claude Opus 4.5",
    "openai/gpt-5.2": "GPT-5.2",
    "google/gemini-3-pro-preview": "Gemini 3 Pro Preview",
    "perplexity/sonar-pro-search": "Perplexity Sonar Pro",
    "anthropic/claude-sonnet-4": "Claude Sonnet 4"
}


async def run_consilium(
    question: str,
    on_stage_update: Optional[Callable[[str, str], Awaitable[None]]] = None
) -> Dict[str, Any]:
    """
    Запустить полный цикл консилиума (3-этапная схема)

    Этап 1: Сбор мнений (Opus + GPT 5.2 + Gemini + Perplexity)
    Этап 2: Peer Review (Claude Sonnet 4) - оценка и извлечение судебных дел
    Этап 3: Синтез (Claude Opus 4.5) - финальное заключение
    """
    result = {
        "question": question,
        "started_at": datetime.utcnow().isoformat(),
        "stages": {},
        "final_answer": None,
        "verified_cases": [],
        "total_tokens": 0
    }

    # Стадия 1: Параллельный сбор мнений от всех 4 экспертов
    if on_stage_update:
        await on_stage_update("stage_1", "Сбор мнений экспертов...")

    opinions = await stage_1_gather_opinions(question)
    result["stages"]["stage_1"] = opinions

    # Стадия 2: Peer Review (Sonnet 4) - оценка экспертов и извлечение судебных дел
    if on_stage_update:
        await on_stage_update("stage_2", "Анализ и оценка экспертов...")

    review_data = await stage_2_peer_review(question, opinions)
    result["stages"]["stage_2"] = review_data.get("cases", [])
    result["stages"]["stage_4"] = review_data.get("reviews", {})  # Для совместимости с фронтендом
    result["verified_cases"] = review_data.get("cases", [])

    # Стадия 3: Финальный синтез (Opus 4.5)
    if on_stage_update:
        await on_stage_update("stage_3", "Формирование итогового ответа...")

    final = await stage_3_final_synthesis(question, opinions, review_data)
    result["final_answer"] = final
    result["stages"]["stage_5"] = {"synthesis": final}  # Для совместимости с фронтендом

    result["completed_at"] = datetime.utcnow().isoformat()

    return result


async def stage_1_gather_opinions(question: str) -> Dict[str, Any]:
    """
    Стадия 1: Параллельный запрос ко всем 4 экспертам
    (Opus + GPT 5.2 + Gemini + Perplexity)
    """
    system_prompt = """Вы — эксперт-юрист по российскому праву, составляющий правовое заключение академического уровня.

МЕТОДОЛОГИЯ АРГУМЕНТАЦИИ:

1. Структура каждого аргумента:
   - Тезис: чёткая формулировка позиции
   - Теоретическое обоснование: доктринальные источники
   - Нормативное подтверждение: ссылки на статьи кодексов
   - Практическое подкрепление: судебные акты
   - Вывод: применение к конкретному случаю

2. Принцип многоуровневой защиты тезиса:
   - Основной аргумент (если принят — вопрос решён)
   - Субсидиарный аргумент («Даже если считать, что [контраргумент], то...»)
   - Запасной аргумент (если оба предыдущих не сработали)

ДОКТРИНАЛЬНЫЙ ФУНДАМЕНТ:

При обосновании позиции опирайтесь на:
- Классическую цивилистику (германская, французская школы)
- Дореволюционную русскую доктрину (Покровский, Шершеневич, Победоносцев)
- Советскую цивилистическую школу (Иоффе, Братусь, Новицкий)
- Современных российских учёных (Суханов, Витрянский, Сарбаш, Карапетов)
- Актуальную практику ВС РФ и КС РФ

СТРУКТУРА ОТВЕТА:

1. Краткий ответ (1–2 абзаца): резюме позиции
2. Развёрнутый анализ по разделам A, B, C:
   - Заголовок раздела — тезис («Договор является незаключённым»)
   - Теоретическое обоснование
   - Нормативная база
   - Судебная практика с номерами дел
   - Промежуточный вывод

СУДЕБНАЯ ПРАКТИКА:

ОБЯЗАТЕЛЬНО приводите релевантную судебную практику:
- Номер дела (А40-12345/2024, 88-1234/2023, 309-ЭС24-1234)
- Суд и дата решения
- Краткая суть правовой позиции
- Цитата ключевого тезиса (если уместно)

СТИЛИСТИКА:

- Точные юридические термины
- Латинские термины курсивом: *res judicata*, *pacta sunt servanda*
- Предложения не более 35 слов
- Одна мысль — один абзац
- Номера статей цифрами: ст. 333 ГК РФ, п. 75 ППВС

ФОРМАТИРОВАНИЕ:

- Иерархическая структура: A, B, C → 1, 2, 3
- Заголовки разделов — тезисы, а не темы
- **Ключевые выводы** выделяйте жирным
- *Цитаты и латынь* — курсивом
- НЕ используйте таблицы, символы #, ##, ###

Отвечайте структурированно, с глубиной академического заключения."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": question}
    ]

    # Параллельные запросы ко всем 4 экспертам (исключая reviewer)
    expert_roles = ["chairman", "expert_1", "expert_2", "expert_3"]
    tasks = []
    for role in expert_roles:
        model_id = CONSILIUM_MODELS[role]
        tasks.append(get_model_opinion(model_id, messages))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    opinions = {}
    model_list = [CONSILIUM_MODELS[role] for role in expert_roles]

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
        lambda: chat_completion(model_id, messages, stream=False, max_tokens=8192)
    )
    content = response["choices"][0]["message"]["content"]
    tokens = response.get("usage", {}).get("total_tokens", 0)
    return {"content": content, "tokens": tokens}


async def stage_2_peer_review(question: str, opinions: Dict[str, Any]) -> Dict[str, Any]:
    """
    Стадия 2: Peer Review (Claude Sonnet 4)
    - Оценка каждого эксперта по критериям
    - Извлечение судебных дел из ответов
    """
    # Собираем все ответы
    all_opinions = "\n\n".join([
        f"=== {op['name']} ===\n{op['content']}"
        for op in opinions.values() if not op.get("error")
    ])

    review_prompt = f"""Проанализируй ответы экспертов на юридический вопрос и выполни ДВЕ задачи:

ВОПРОС: {question}

ОТВЕТЫ ЭКСПЕРТОВ:
{all_opinions}

ЗАДАЧА 1: Оцени каждый ответ по критериям (1-10):
1. Правовая точность
2. Практическая применимость
3. Качество аргументации
4. Использование судебной практики

ЗАДАЧА 2: Извлеки ВСЕ упоминания судебных дел из всех ответов.

Ответь СТРОГО в формате JSON:
{{
  "reviews": {{
    "Claude Opus 4.5": {{
      "legal_accuracy": 8,
      "practical_value": 7,
      "argumentation": 8,
      "case_usage": 7,
      "total": 7.5,
      "strengths": ["сильные стороны"],
      "weaknesses": ["слабые стороны"]
    }},
    "GPT-5.2": {{ ... }},
    "Gemini 3 Pro Preview": {{ ... }},
    "Perplexity Sonar Pro": {{ ... }}
  }},
  "ranking": ["лучший эксперт", "второй", "третий", "четвертый"],
  "cases": [
    {{
      "case_number": "А40-12345/2024",
      "court": "название суда",
      "date": "дата если указана",
      "summary": "краткая суть правовой позиции",
      "source_model": "какая модель указала это дело",
      "status": "FROM_EXPERT"
    }}
  ]
}}

Если судебных дел не упомянуто, верни пустой массив cases: []"""

    messages = [{"role": "user", "content": review_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(CONSILIUM_MODELS["reviewer"], messages, stream=False, max_tokens=4096)
        )
        content = response["choices"][0]["message"]["content"]

        # Парсим JSON из ответа
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
    review_data: Dict[str, Any]
) -> str:
    """
    Стадия 3: Финальный синтез (Claude Opus 4.5)
    """
    cases = review_data.get("cases", [])
    reviews = review_data.get("reviews", {})
    ranking = review_data.get("ranking", [])

    synthesis_prompt = f"""Сформируй ИТОГОВОЕ ПРАВОВОЕ ЗАКЛЮЧЕНИЕ, объединив лучшие элементы ответов экспертов консилиума.

ВОПРОС: {question}

ОТВЕТЫ ЭКСПЕРТОВ:
"""
    for op in opinions.values():
        if not op.get("error"):
            synthesis_prompt += f"\n=== {op['name']} ===\n{op['content']}\n"

    synthesis_prompt += f"""

РЕЙТИНГ ЭКСПЕРТОВ: {ranking}

СУДЕБНАЯ ПРАКТИКА ИЗ ОТВЕТОВ ЭКСПЕРТОВ:
"""
    if cases:
        for case in cases:
            synthesis_prompt += f"- {case.get('case_number')}: {case.get('summary', 'N/A')} (источник: {case.get('source_model', 'N/A')})\n"
    else:
        synthesis_prompt += "Судебных дел не найдено.\n"

    synthesis_prompt += """

СТРУКТУРА ИТОГОВОГО ЗАКЛЮЧЕНИЯ:

1. **Краткие ответы** — резюме выводов (1–2 абзаца)

2. **Развёрнутый анализ** по разделам A, B, C...:
   - Заголовок раздела = тезис («Договор подлежит расторжению»)
   - Теоретическое обоснование (доктрина)
   - Нормативная база (статьи кодексов)
   - Судебная практика (из ответов экспертов)
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
