"""
Web Search Service using Perplexity via OpenRouter
"""
import asyncio
from typing import Generator
from app.services.openrouter import chat_completion, chat_completion_stream


# Модель с поиском в интернете
SEARCH_MODEL = "perplexity/sonar-pro-search"


def web_search(query: str, context: str = "") -> dict:
    """
    Выполнить поиск в интернете через Perplexity Sonar Pro

    Args:
        query: Поисковый запрос
        context: Дополнительный контекст для запроса

    Returns:
        dict с результатом поиска
    """
    system_prompt = """Ты - помощник для поиска юридической информации в интернете.
Отвечай на русском языке.

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. НИКОГДА не выдумывай URL-адреса! Указывай ТОЛЬКО реально найденные ссылки.
2. НЕ используй consultant.ru и garant.ru - их ссылки требуют авторизации и не работают.
3. Если не можешь найти ссылку - честно скажи об этом.

ПРИОРИТЕТНЫЕ ОТКРЫТЫЕ ИСТОЧНИКИ для судебной практики:
- sudact.ru - Судебные акты РФ (открытая база)
- kad.arbitr.ru - Картотека арбитражных дел
- vsrf.ru - Верховный Суд РФ
- arbitr.ru - Федеральные арбитражные суды
- pravo.gov.ru - Официальный портал правовой информации

Форматируй ответ структурированно с указанием найденных фактов и РЕАЛЬНЫХ ссылок.
Лучше честно сказать "ссылка не найдена", чем дать выдуманную ссылку."""

    messages = [
        {"role": "system", "content": system_prompt}
    ]

    if context:
        messages.append({
            "role": "user",
            "content": f"Контекст: {context}\n\nПоисковый запрос: {query}"
        })
    else:
        messages.append({"role": "user", "content": query})

    response = chat_completion(SEARCH_MODEL, messages, stream=False, max_tokens=4096)
    content = response["choices"][0]["message"]["content"]
    tokens = response.get("usage", {}).get("total_tokens", 0)

    return {
        "content": content,
        "tokens": tokens,
        "model": SEARCH_MODEL
    }


def web_search_stream(query: str, context: str = "") -> Generator[str, None, None]:
    """
    Стриминговый поиск в интернете

    Args:
        query: Поисковый запрос
        context: Дополнительный контекст

    Yields:
        Чанки ответа
    """
    system_prompt = """Ты - помощник для поиска юридической информации в интернете.
Отвечай на русском языке.

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. НИКОГДА не выдумывай URL-адреса! Указывай ТОЛЬКО реально найденные ссылки.
2. НЕ используй consultant.ru и garant.ru - их ссылки требуют авторизации и не работают.
3. Если не можешь найти ссылку - честно скажи об этом.

ПРИОРИТЕТНЫЕ ОТКРЫТЫЕ ИСТОЧНИКИ для судебной практики:
- sudact.ru - Судебные акты РФ (открытая база)
- kad.arbitr.ru - Картотека арбитражных дел
- vsrf.ru - Верховный Суд РФ
- arbitr.ru - Федеральные арбитражные суды
- pravo.gov.ru - Официальный портал правовой информации

Форматируй ответ структурированно с указанием найденных фактов и РЕАЛЬНЫХ ссылок.
Лучше честно сказать "ссылка не найдена", чем дать выдуманную ссылку."""

    messages = [
        {"role": "system", "content": system_prompt}
    ]

    if context:
        messages.append({
            "role": "user",
            "content": f"Контекст: {context}\n\nПоисковый запрос: {query}"
        })
    else:
        messages.append({"role": "user", "content": query})

    yield from chat_completion_stream(SEARCH_MODEL, messages, max_tokens=4096)


async def async_web_search(query: str, context: str = "") -> dict:
    """
    Асинхронный поиск в интернете
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: web_search(query, context))
