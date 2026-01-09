"""
Google Custom Search API Service
Интеграция с Google Custom Search для поиска судебной практики
"""
import httpx
import asyncio
from typing import List, Dict, Any, Optional
from app.config import settings


# Google Custom Search API endpoint
GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"

# Приоритетные домены для юридического поиска (ранжирование)
LEGAL_DOMAINS_PRIORITY = [
    "sudact.ru",           # Судебные акты РФ
    "kad.arbitr.ru",       # Картотека арбитражных дел
    "consultant.ru",       # КонсультантПлюс
    "garant.ru",           # Гарант
    "vsrf.ru",             # Верховный Суд РФ
    "arbitr.ru",           # Федеральные арбитражные суды
    "sudrf.ru",            # Суды общей юрисдикции
    "ras.arbitr.ru",       # Электронное правосудие
    "pravo.gov.ru",        # Официальный интернет-портал правовой информации
]


def google_search(
    query: str,
    num_results: int = 10,
    site_restrict: Optional[str] = None,
    language: str = "lang_ru"
) -> Dict[str, Any]:
    """
    Выполнить поиск через Google Custom Search API

    Args:
        query: Поисковый запрос
        num_results: Количество результатов (макс 10 за запрос)
        site_restrict: Ограничение по сайту (например, "sudact.ru")
        language: Язык результатов

    Returns:
        dict с результатами поиска
    """
    if not settings.google_api_key or not settings.google_cx:
        return {
            "success": False,
            "error": "Google Search API не настроен. Укажите GOOGLE_API_KEY и GOOGLE_CX в настройках.",
            "items": []
        }

    # Формируем поисковый запрос
    search_query = query
    if site_restrict:
        search_query = f"site:{site_restrict} {query}"

    params = {
        "key": settings.google_api_key,
        "cx": settings.google_cx,
        "q": search_query,
        "num": min(num_results, 10),  # Google API limit
        "lr": language,
        "gl": "ru",  # Геолокация - Россия
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(GOOGLE_SEARCH_URL, params=params)
            response.raise_for_status()
            data = response.json()

            items = data.get("items", [])

            # Ранжируем результаты по приоритетным доменам
            ranked_items = rank_by_legal_domains(items)

            return {
                "success": True,
                "query": query,
                "total_results": data.get("searchInformation", {}).get("totalResults", "0"),
                "items": ranked_items,
                "search_time": data.get("searchInformation", {}).get("searchTime", 0)
            }

    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "error": f"HTTP ошибка: {e.response.status_code}",
            "items": []
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "items": []
        }


async def async_google_search(
    query: str,
    num_results: int = 10,
    site_restrict: Optional[str] = None,
    language: str = "lang_ru"
) -> Dict[str, Any]:
    """
    Асинхронный поиск через Google Custom Search API
    """
    if not settings.google_api_key or not settings.google_cx:
        return {
            "success": False,
            "error": "Google Search API не настроен. Укажите GOOGLE_API_KEY и GOOGLE_CX в настройках.",
            "items": []
        }

    search_query = query
    if site_restrict:
        search_query = f"site:{site_restrict} {query}"

    params = {
        "key": settings.google_api_key,
        "cx": settings.google_cx,
        "q": search_query,
        "num": min(num_results, 10),
        "lr": language,
        "gl": "ru",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(GOOGLE_SEARCH_URL, params=params)
            response.raise_for_status()
            data = response.json()

            items = data.get("items", [])
            ranked_items = rank_by_legal_domains(items)

            return {
                "success": True,
                "query": query,
                "total_results": data.get("searchInformation", {}).get("totalResults", "0"),
                "items": ranked_items,
                "search_time": data.get("searchInformation", {}).get("searchTime", 0)
            }

    except httpx.HTTPStatusError as e:
        return {
            "success": False,
            "error": f"HTTP ошибка: {e.response.status_code}",
            "items": []
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "items": []
        }


def rank_by_legal_domains(items: List[Dict]) -> List[Dict]:
    """
    Ранжирует результаты поиска, поднимая юридические источники выше
    """
    def get_priority(item: Dict) -> int:
        link = item.get("link", "").lower()
        for i, domain in enumerate(LEGAL_DOMAINS_PRIORITY):
            if domain in link:
                return i
        return len(LEGAL_DOMAINS_PRIORITY)  # Неизвестные домены в конец

    # Добавляем информацию о домене
    for item in items:
        link = item.get("link", "")
        item["is_legal_source"] = any(domain in link.lower() for domain in LEGAL_DOMAINS_PRIORITY)
        item["priority"] = get_priority(item)

    # Сортируем по приоритету
    return sorted(items, key=lambda x: x.get("priority", 999))


async def search_court_case(case_number: str) -> Dict[str, Any]:
    """
    Поиск информации о конкретном судебном деле

    Args:
        case_number: Номер дела (например, А40-12345/2024)

    Returns:
        Информация о деле с нескольких источников
    """
    results = {
        "case_number": case_number,
        "found": False,
        "sources": [],
        "details": []
    }

    # Поиск по разным юридическим базам параллельно
    search_queries = [
        f'"{case_number}" судебное решение',
        f'"{case_number}" арбитражный суд',
        f'дело {case_number}',
    ]

    # Выполняем первый поиск
    main_result = await async_google_search(search_queries[0], num_results=5)

    if main_result["success"] and main_result["items"]:
        results["found"] = True

        for item in main_result["items"]:
            source_info = {
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "is_legal_source": item.get("is_legal_source", False),
            }
            results["sources"].append(source_info)

            # Извлекаем домен
            link = item.get("link", "")
            for domain in LEGAL_DOMAINS_PRIORITY:
                if domain in link.lower():
                    if domain not in [d.get("domain") for d in results["details"]]:
                        results["details"].append({
                            "domain": domain,
                            "link": link,
                            "title": item.get("title", "")
                        })
                    break

    return results


async def search_legal_topic(
    topic: str,
    include_cases: bool = True,
    include_legislation: bool = True
) -> Dict[str, Any]:
    """
    Поиск по юридической теме с фильтрацией источников

    Args:
        topic: Тема поиска
        include_cases: Включить судебную практику
        include_legislation: Включить законодательство

    Returns:
        Структурированные результаты поиска
    """
    results = {
        "topic": topic,
        "court_cases": [],
        "legislation": [],
        "articles": [],
        "total_found": 0
    }

    # Поиск судебной практики
    if include_cases:
        case_query = f"{topic} судебная практика решение суда"
        case_results = await async_google_search(case_query, num_results=5)

        if case_results["success"]:
            for item in case_results["items"]:
                if item.get("is_legal_source"):
                    results["court_cases"].append({
                        "title": item.get("title", ""),
                        "link": item.get("link", ""),
                        "snippet": item.get("snippet", ""),
                    })

    # Поиск законодательства
    if include_legislation:
        law_query = f"{topic} закон статья кодекс"
        law_results = await async_google_search(law_query, num_results=5)

        if law_results["success"]:
            for item in law_results["items"]:
                link = item.get("link", "").lower()
                if "consultant.ru" in link or "garant.ru" in link or "pravo.gov.ru" in link:
                    results["legislation"].append({
                        "title": item.get("title", ""),
                        "link": item.get("link", ""),
                        "snippet": item.get("snippet", ""),
                    })

    results["total_found"] = len(results["court_cases"]) + len(results["legislation"])

    return results


async def verify_case_with_google(case_number: str) -> Dict[str, Any]:
    """
    Верификация существования судебного дела через Google Search
    Используется в consilium для дополнительной проверки

    Returns:
        {
            "exists": bool,
            "confidence": "high" | "medium" | "low",
            "sources": List[str],
            "links": List[str],
            "snippets": List[str]
        }
    """
    result = await search_court_case(case_number)

    verification = {
        "exists": False,
        "confidence": "low",
        "sources": [],
        "links": [],
        "snippets": []
    }

    if not result["found"]:
        return verification

    # Анализируем найденные источники
    legal_sources_count = 0
    official_sources = []

    for source in result["sources"]:
        link = source.get("link", "").lower()

        # Проверяем официальные источники
        if any(domain in link for domain in ["sudact.ru", "kad.arbitr.ru", "arbitr.ru", "vsrf.ru"]):
            legal_sources_count += 1
            official_sources.append(source)
            verification["sources"].append(link.split("/")[2])  # Домен
            verification["links"].append(source.get("link", ""))
            verification["snippets"].append(source.get("snippet", ""))

    # Определяем уровень уверенности
    if legal_sources_count >= 2:
        verification["exists"] = True
        verification["confidence"] = "high"
    elif legal_sources_count == 1:
        verification["exists"] = True
        verification["confidence"] = "medium"
    elif result["sources"]:
        # Есть результаты, но не из официальных источников
        verification["exists"] = True
        verification["confidence"] = "low"
        for source in result["sources"][:3]:
            verification["links"].append(source.get("link", ""))
            verification["snippets"].append(source.get("snippet", ""))

    return verification


def format_search_results_for_display(results: Dict[str, Any]) -> str:
    """
    Форматирует результаты поиска для отображения пользователю
    """
    if not results.get("success"):
        return f"Ошибка поиска: {results.get('error', 'Неизвестная ошибка')}"

    output = []
    output.append(f"Найдено результатов: {results.get('total_results', 0)}")
    output.append(f"Время поиска: {results.get('search_time', 0):.2f} сек.\n")

    for i, item in enumerate(results.get("items", []), 1):
        title = item.get("title", "Без заголовка")
        link = item.get("link", "")
        snippet = item.get("snippet", "")
        is_legal = "🏛️" if item.get("is_legal_source") else ""

        output.append(f"{i}. {is_legal} {title}")
        output.append(f"   {link}")
        output.append(f"   {snippet}\n")

    return "\n".join(output)
