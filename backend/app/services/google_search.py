"""
Web Search Service via OpenRouter (Perplexity)
Поиск судебной практики через OpenRouter без отдельного Google API ключа
"""
import asyncio
import json
import re
from typing import List, Dict, Any, Optional
from app.services.openrouter import chat_completion
from app.config import settings


# Модель для поиска
SEARCH_MODEL = "perplexity/sonar-pro-search"

# Приоритетные домены для юридического поиска (ранжирование)
# ВАЖНО: consultant.ru и garant.ru убраны - их ссылки требуют авторизации
LEGAL_DOMAINS_PRIORITY = [
    "sudact.ru",           # Судебные акты РФ (открытая база, приоритет №1)
    "kad.arbitr.ru",       # Картотека арбитражных дел (открытая)
    "vsrf.ru",             # Верховный Суд РФ (официальный)
    "arbitr.ru",           # Федеральные арбитражные суды
    "sudrf.ru",            # Суды общей юрисдикции
    "ras.arbitr.ru",       # Электронное правосудие
    "pravo.gov.ru",        # Официальный интернет-портал правовой информации
]

# Домены которые НЕ следует использовать (требуют авторизации, сложные URL)
BLOCKED_DOMAINS = [
    "consultant.ru",       # КонсультантПлюс - требует авторизации
    "garant.ru",           # Гарант - требует авторизации
]


async def async_google_search(
    query: str,
    num_results: int = 10,
    site_restrict: Optional[str] = None,
    language: str = "lang_ru"
) -> Dict[str, Any]:
    """
    Поиск через Perplexity (OpenRouter) - замена Google Custom Search

    Args:
        query: Поисковый запрос
        num_results: Количество результатов
        site_restrict: Ограничение по сайту
        language: Язык (не используется, Perplexity сам определяет)

    Returns:
        dict с результатами поиска
    """
    search_query = query
    if site_restrict:
        search_query = f"site:{site_restrict} {query}"

    system_prompt = """Ты - поисковый помощник для юридических запросов. Найди РЕАЛЬНУЮ информацию в интернете.

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. НИКОГДА не выдумывай и не генерируй URL-адреса! Указывай ТОЛЬКО те ссылки, которые ты реально нашёл при поиске.
2. Если не можешь найти конкретную ссылку - честно скажи об этом, НЕ придумывай URL.
3. НЕ используй consultant.ru - их ссылки требуют авторизации и имеют сложные хеши.

ПРИОРИТЕТНЫЕ ОТКРЫТЫЕ ИСТОЧНИКИ (используй в первую очередь):
- sudact.ru - Судебные акты РФ (открытая база)
- kad.arbitr.ru - Картотека арбитражных дел (открытая)
- vsrf.ru - Верховный Суд РФ (официальный)
- arbitr.ru - Федеральные арбитражные суды
- pravo.gov.ru - Официальный портал правовой информации

ФОРМАТ ОТВЕТА:
Для каждого найденного результата укажи:
1. Номер судебного дела или название документа
2. Реальную проверенную ссылку
3. Краткое описание

Если информация не найдена - так и напиши. Лучше честно сказать "не найдено", чем дать выдуманную ссылку."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Найди: {search_query}"}
    ]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(SEARCH_MODEL, messages, stream=False, max_tokens=4096)
        )
        content = response["choices"][0]["message"]["content"]

        # Парсим результаты из текста
        items = parse_search_results(content)
        ranked_items = rank_by_legal_domains(items)

        return {
            "success": True,
            "query": query,
            "total_results": str(len(ranked_items)),
            "items": ranked_items,
            "search_time": 0,
            "raw_content": content
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "items": []
        }


def google_search(
    query: str,
    num_results: int = 10,
    site_restrict: Optional[str] = None,
    language: str = "lang_ru"
) -> Dict[str, Any]:
    """
    Синхронная обёртка для async_google_search
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(
            async_google_search(query, num_results, site_restrict, language)
        )
    finally:
        loop.close()


def is_blocked_domain(url: str) -> bool:
    """
    Проверяет, является ли URL заблокированным доменом
    """
    url_lower = url.lower()
    return any(domain in url_lower for domain in BLOCKED_DOMAINS)


def parse_search_results(content: str) -> List[Dict]:
    """
    Парсит результаты поиска из текстового ответа Perplexity
    Фильтрует заблокированные домены (consultant.ru, garant.ru)
    """
    items = []

    # Ищем URL-ы в тексте
    url_pattern = r'https?://[^\s\)\]<>\"\']+[^\s\.\,\)\]\<\>\"\':]'
    urls = re.findall(url_pattern, content)

    # Убираем дубликаты, сохраняя порядок
    seen = set()
    unique_urls = []
    for url in urls:
        # Очищаем URL от мусора в конце
        url = url.rstrip('.,;:')
        if url not in seen:
            # Фильтруем заблокированные домены
            if is_blocked_domain(url):
                continue
            seen.add(url)
            unique_urls.append(url)

    # Разбиваем текст на части для извлечения контекста
    lines = content.split('\n')

    for url in unique_urls[:10]:  # Макс 10 результатов
        item = {
            "title": extract_title_for_url(content, url),
            "link": url,
            "snippet": extract_snippet_for_url(content, url),
            "is_legal_source": False,
            "priority": 999
        }
        items.append(item)

    return items


def extract_title_for_url(content: str, url: str) -> str:
    """
    Пытается извлечь заголовок для URL из контекста
    """
    # Ищем текст перед URL (обычно это заголовок)
    pattern = r'[\d\.\)]\s*\*?\*?([^*\n]+?)\*?\*?\s*[-–:]?\s*' + re.escape(url[:30])
    match = re.search(pattern, content, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    # Извлекаем домен как запасной вариант
    domain_match = re.search(r'https?://([^/]+)', url)
    if domain_match:
        return domain_match.group(1)

    return "Результат поиска"


def extract_snippet_for_url(content: str, url: str) -> str:
    """
    Пытается извлечь описание для URL из контекста
    """
    # Ищем текст после URL
    url_pos = content.find(url)
    if url_pos != -1:
        after_url = content[url_pos + len(url):url_pos + len(url) + 300]
        # Берём первое предложение или строку
        lines = after_url.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line and len(line) > 20 and not line.startswith('http'):
                return line[:200]

    return ""


def rank_by_legal_domains(items: List[Dict]) -> List[Dict]:
    """
    Ранжирует результаты поиска, поднимая юридические источники выше
    """
    def get_priority(item: Dict) -> int:
        link = item.get("link", "").lower()
        for i, domain in enumerate(LEGAL_DOMAINS_PRIORITY):
            if domain in link:
                return i
        return len(LEGAL_DOMAINS_PRIORITY)

    for item in items:
        link = item.get("link", "")
        item["is_legal_source"] = any(domain in link.lower() for domain in LEGAL_DOMAINS_PRIORITY)
        item["priority"] = get_priority(item)

    return sorted(items, key=lambda x: x.get("priority", 999))


async def search_court_case(case_number: str) -> Dict[str, Any]:
    """
    Поиск информации о конкретном судебном деле через Perplexity
    """
    system_prompt = f"""Найди информацию о судебном деле {case_number} в российских судебных базах данных.

КРИТИЧЕСКИ ВАЖНО:
- НИКОГДА не выдумывай URL-адреса! Указывай ТОЛЬКО реально найденные ссылки.
- НЕ используй consultant.ru и garant.ru - их ссылки требуют авторизации.

Ищи ТОЛЬКО в открытых источниках:
- sudact.ru - Судебные акты РФ (открытая база, ищи здесь в первую очередь)
- kad.arbitr.ru - Картотека арбитражных дел (для арбитражных дел)
- vsrf.ru - Верховный Суд РФ
- arbitr.ru - Федеральные арбитражные суды

Для каждого найденного результата укажи:
1. Реальную проверенную ссылку на источник
2. Название суда
3. Дату решения (если есть)
4. Краткую суть дела

Если дело НЕ НАЙДЕНО - честно напиши "Дело не найдено в открытых источниках". НЕ придумывай ссылки!"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Найди судебное дело: {case_number}"}
    ]

    results = {
        "case_number": case_number,
        "found": False,
        "sources": [],
        "details": [],
        "raw_response": ""
    }

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(SEARCH_MODEL, messages, stream=False, max_tokens=2048)
        )
        content = response["choices"][0]["message"]["content"]
        results["raw_response"] = content

        # Ищем URL-ы в ответе
        url_pattern = r'https?://[^\s\)\]<>\"\']+[^\s\.\,\)\]\<\>\"\':]'
        urls = re.findall(url_pattern, content)

        if urls:
            results["found"] = True
            for url in urls[:5]:
                url = url.rstrip('.,;:')
                source_info = {
                    "title": extract_title_for_url(content, url),
                    "link": url,
                    "snippet": extract_snippet_for_url(content, url),
                    "is_legal_source": any(domain in url.lower() for domain in LEGAL_DOMAINS_PRIORITY),
                }
                results["sources"].append(source_info)

                # Определяем домен
                for domain in LEGAL_DOMAINS_PRIORITY:
                    if domain in url.lower():
                        results["details"].append({
                            "domain": domain,
                            "link": url,
                            "title": source_info["title"]
                        })
                        break

        # Проверяем, не сказано ли явно что дело не найдено
        not_found_phrases = ["не найден", "не удалось найти", "отсутствует", "нет информации", "не обнаружен"]
        if any(phrase in content.lower() for phrase in not_found_phrases) and not urls:
            results["found"] = False

    except Exception as e:
        results["error"] = str(e)

    return results


async def search_legal_topic(
    topic: str,
    include_cases: bool = True,
    include_legislation: bool = True
) -> Dict[str, Any]:
    """
    Поиск по юридической теме через Perplexity
    """
    results = {
        "topic": topic,
        "court_cases": [],
        "legislation": [],
        "articles": [],
        "total_found": 0
    }

    # Общий поисковый запрос
    search_parts = []
    if include_cases:
        search_parts.append("судебная практика")
    if include_legislation:
        search_parts.append("законодательство статьи")

    system_prompt = f"""Найди юридическую информацию по теме: {topic}

КРИТИЧЕСКИ ВАЖНО:
- НИКОГДА не выдумывай URL-адреса! Указывай ТОЛЬКО реально найденные ссылки.
- НЕ используй consultant.ru и garant.ru - их ссылки требуют авторизации и не работают.

Раздели результаты на категории:

1. СУДЕБНАЯ ПРАКТИКА - решения судов, судебные акты
   Используй ТОЛЬКО: sudact.ru, kad.arbitr.ru, vsrf.ru, arbitr.ru

2. ЗАКОНОДАТЕЛЬСТВО - законы, кодексы, нормативные акты
   Используй ТОЛЬКО: pravo.gov.ru (официальный портал)

Для каждого результата укажи:
- Заголовок документа/дела
- Реальную проверенную ссылку
- Краткое описание

Если не можешь найти информацию - честно скажи об этом. НЕ выдумывай ссылки!"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Найди информацию по теме: {topic} {' '.join(search_parts)}"}
    ]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(SEARCH_MODEL, messages, stream=False, max_tokens=4096)
        )
        content = response["choices"][0]["message"]["content"]

        # Парсим результаты
        items = parse_search_results(content)

        for item in items:
            link = item.get("link", "").lower()

            # Классифицируем по типу источника
            if any(domain in link for domain in ["sudact.ru", "kad.arbitr.ru", "vsrf.ru", "arbitr.ru"]):
                results["court_cases"].append({
                    "title": item["title"],
                    "link": item["link"],
                    "snippet": item["snippet"],
                })
            elif any(domain in link for domain in ["consultant.ru", "garant.ru", "pravo.gov.ru"]):
                results["legislation"].append({
                    "title": item["title"],
                    "link": item["link"],
                    "snippet": item["snippet"],
                })
            else:
                results["articles"].append({
                    "title": item["title"],
                    "link": item["link"],
                    "snippet": item["snippet"],
                })

        results["total_found"] = len(results["court_cases"]) + len(results["legislation"]) + len(results["articles"])
        results["raw_content"] = content

    except Exception as e:
        results["error"] = str(e)

    return results


async def verify_case_with_google(case_number: str) -> Dict[str, Any]:
    """
    Верификация существования судебного дела через Perplexity
    Используется в consilium для дополнительной проверки
    """
    result = await search_court_case(case_number)

    verification = {
        "exists": False,
        "confidence": "low",
        "sources": [],
        "links": [],
        "snippets": []
    }

    if not result.get("found"):
        return verification

    # Анализируем найденные источники
    legal_sources_count = 0

    for source in result.get("sources", []):
        link = source.get("link", "").lower()

        # Проверяем официальные источники
        if any(domain in link for domain in ["sudact.ru", "kad.arbitr.ru", "arbitr.ru", "vsrf.ru"]):
            legal_sources_count += 1
            try:
                domain = link.split("/")[2]
                verification["sources"].append(domain)
            except:
                pass
            verification["links"].append(source.get("link", ""))
            verification["snippets"].append(source.get("snippet", ""))

    # Определяем уровень уверенности
    if legal_sources_count >= 2:
        verification["exists"] = True
        verification["confidence"] = "high"
    elif legal_sources_count == 1:
        verification["exists"] = True
        verification["confidence"] = "medium"
    elif result.get("sources"):
        verification["exists"] = True
        verification["confidence"] = "low"
        for source in result["sources"][:3]:
            verification["links"].append(source.get("link", ""))
            verification["snippets"].append(source.get("snippet", ""))

    # Добавляем raw ответ для отладки
    verification["raw_response"] = result.get("raw_response", "")

    return verification


def format_search_results_for_display(results: Dict[str, Any]) -> str:
    """
    Форматирует результаты поиска для отображения пользователю
    """
    if not results.get("success"):
        return f"Ошибка поиска: {results.get('error', 'Неизвестная ошибка')}"

    # Если есть raw_content (полный ответ от Perplexity), показываем его
    if results.get("raw_content"):
        return results["raw_content"]

    output = []
    output.append(f"Найдено результатов: {results.get('total_results', 0)}\n")

    for i, item in enumerate(results.get("items", []), 1):
        title = item.get("title", "Без заголовка")
        link = item.get("link", "")
        snippet = item.get("snippet", "")
        is_legal = "🏛️" if item.get("is_legal_source") else ""

        output.append(f"{i}. {is_legal} **{title}**")
        output.append(f"   {link}")
        if snippet:
            output.append(f"   {snippet}\n")
        else:
            output.append("")

    return "\n".join(output)
