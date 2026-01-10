"""
Perplexity Search Service - поиск актуальной юридической информации через Perplexity Sonar Pro
"""
import requests
import json
from typing import Generator

from app.config import settings

SEARCH_SYSTEM_PROMPT = """Найди актуальную информацию по юридическому вопросу.

ПРИОРИТЕТНЫЕ ИСТОЧНИКИ:
- kad.arbitr.ru — Картотека арбитражных дел
- sudact.ru — Судебные акты РФ
- consultant.ru — КонсультантПлюс
- garant.ru — Гарант
- pravo.gov.ru — Официальный портал правовой информации
- vsrf.ru — Верховный Суд РФ

ЧТО ИСКАТЬ:
1. Релевантную судебную практику (номера дел, позиции судов)
2. Актуальные изменения законодательства
3. Позиции ВС РФ и КС РФ по теме
4. Разъяснения государственных органов

ФОРМАТ ОТВЕТА:
- Судебная практика: номер дела, суд, дата, суть позиции
- Законодательство: название акта, статья, суть нормы
- Актуальные изменения: дата, источник, суть

Если информации по теме недостаточно — укажи это явно."""

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


def _get_headers() -> dict:
    """Возвращает заголовки для запросов к OpenRouter"""
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "HTTP-Referer": "https://sgc-legal-ai.vercel.app",
        "X-Title": "SGC Legal AI",
        "Content-Type": "application/json"
    }


def search(query: str, max_tokens: int = 2048) -> str:
    """
    Синхронный поиск через Perplexity Sonar Pro.

    Args:
        query: Поисковый запрос
        max_tokens: Максимальное количество токенов ответа

    Returns:
        Текст ответа от Perplexity
    """
    payload = {
        "model": settings.model_search,
        "messages": [
            {"role": "system", "content": SEARCH_SYSTEM_PROMPT},
            {"role": "user", "content": query}
        ],
        "max_tokens": max_tokens,
        "stream": False
    }

    response = requests.post(
        OPENROUTER_API_URL,
        headers=_get_headers(),
        json=payload,
        timeout=60
    )
    response.raise_for_status()

    data = response.json()
    return data["choices"][0]["message"]["content"]


def search_stream(query: str, max_tokens: int = 2048) -> Generator[str, None, None]:
    """
    Потоковый поиск через Perplexity Sonar Pro.

    Args:
        query: Поисковый запрос
        max_tokens: Максимальное количество токенов ответа

    Yields:
        Чанки ответа в формате JSON
    """
    payload = {
        "model": settings.model_search,
        "messages": [
            {"role": "system", "content": SEARCH_SYSTEM_PROMPT},
            {"role": "user", "content": query}
        ],
        "max_tokens": max_tokens,
        "stream": True
    }

    response = requests.post(
        OPENROUTER_API_URL,
        headers=_get_headers(),
        json=payload,
        stream=True,
        timeout=60
    )
    response.raise_for_status()

    for line in response.iter_lines():
        if line:
            line_text = line.decode("utf-8")
            if line_text.startswith("data: "):
                data_str = line_text[6:]
                if data_str.strip() == "[DONE]":
                    break
                yield data_str
