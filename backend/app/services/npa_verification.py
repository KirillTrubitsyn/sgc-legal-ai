"""
NPA (Normative Legal Acts) verification service
Верификация ссылок на нормативно-правовые акты через Perplexity Sonar Pro
"""
import re
import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from app.services.openrouter import chat_completion
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class NpaReference:
    """Ссылка на нормативно-правовой акт"""
    act_type: str  # Тип акта: ГК, УК, КоАП, ФЗ, и т.д.
    act_name: str  # Полное название акта
    article: str  # Номер статьи
    part: Optional[str] = None  # Часть статьи
    paragraph: Optional[str] = None  # Пункт статьи
    subparagraph: Optional[str] = None  # Подпункт
    raw_reference: str = ""  # Исходная ссылка в тексте

    def to_dict(self) -> Dict[str, Any]:
        return {
            "act_type": self.act_type,
            "act_name": self.act_name,
            "article": self.article,
            "part": self.part,
            "paragraph": self.paragraph,
            "subparagraph": self.subparagraph,
            "raw_reference": self.raw_reference
        }


@dataclass
class VerifiedNpa:
    """Верифицированный НПА"""
    reference: NpaReference
    status: str  # VERIFIED, AMENDED, REPEALED, NOT_FOUND
    is_active: bool  # Действует ли норма
    current_text: Optional[str] = None  # Актуальный текст нормы
    verification_source: str = "perplexity"
    amendment_info: Optional[str] = None  # Информация о изменениях
    repeal_info: Optional[str] = None  # Информация об утрате силы
    sources: List[str] = None  # Источники проверки
    confidence: str = "medium"  # high, medium, low

    def __post_init__(self):
        if self.sources is None:
            self.sources = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            **self.reference.to_dict(),
            "status": self.status,
            "is_active": self.is_active,
            "current_text": self.current_text,
            "verification_source": self.verification_source,
            "amendment_info": self.amendment_info,
            "repeal_info": self.repeal_info,
            "sources": self.sources,
            "confidence": self.confidence
        }


# Регулярные выражения для извлечения ссылок на НПА
NPA_PATTERNS = [
    # Статьи кодексов: ст. 333 ГК РФ, ст. 15 УК РФ
    r'ст(?:атьи?|\.)\s*(\d+(?:\.\d+)?)\s+([А-ЯЁ]{2,5})\s*РФ',
    # Части статей: ч. 1 ст. 333 ГК РФ
    r'ч(?:асти?|\.)\s*(\d+)\s+ст(?:атьи?|\.)\s*(\d+(?:\.\d+)?)\s+([А-ЯЁ]{2,5})\s*РФ',
    # Пункты статей: п. 1 ст. 333 ГК РФ
    r'п(?:ункта?|\.)\s*(\d+)\s+ст(?:атьи?|\.)\s*(\d+(?:\.\d+)?)\s+([А-ЯЁ]{2,5})\s*РФ',
    # Федеральные законы: ФЗ от 08.02.1998 N 14-ФЗ
    r'(?:Федеральн(?:ого|ый)\s+закон(?:а)?|ФЗ)\s+от\s+(\d{2}\.\d{2}\.\d{4})\s*[NН№]\s*(\d+(?:-ФЗ)?)',
    # Постановления Правительства
    r'[Пп]остановлени[еия]\s+Правительства\s*РФ\s+от\s+(\d{2}\.\d{2}\.\d{4})\s*[NН№]\s*(\d+)',
    # Указы Президента
    r'[Уу]каз(?:а)?\s+Президента\s*РФ\s+от\s+(\d{2}\.\d{2}\.\d{4})\s*[NН№]\s*(\d+)',
    # Приказы министерств
    r'[Пп]риказ(?:а)?\s+([А-ЯЁа-яё]+)\s+(?:России|РФ)\s+от\s+(\d{2}\.\d{2}\.\d{4})\s*[NН№]\s*(\d+)',
]

# Расшифровка аббревиатур кодексов
CODE_NAMES = {
    "ГК": "Гражданский кодекс Российской Федерации",
    "УК": "Уголовный кодекс Российской Федерации",
    "КоАП": "Кодекс Российской Федерации об административных правонарушениях",
    "ТК": "Трудовой кодекс Российской Федерации",
    "НК": "Налоговый кодекс Российской Федерации",
    "АПК": "Арбитражный процессуальный кодекс Российской Федерации",
    "ГПК": "Гражданский процессуальный кодекс Российской Федерации",
    "УПК": "Уголовно-процессуальный кодекс Российской Федерации",
    "КАС": "Кодекс административного судопроизводства Российской Федерации",
    "СК": "Семейный кодекс Российской Федерации",
    "ЖК": "Жилищный кодекс Российской Федерации",
    "ЗК": "Земельный кодекс Российской Федерации",
    "ЛК": "Лесной кодекс Российской Федерации",
    "ВК": "Водный кодекс Российской Федерации",
    "БК": "Бюджетный кодекс Российской Федерации",
    "УИК": "Уголовно-исполнительный кодекс Российской Федерации",
    "ВозК": "Воздушный кодекс Российской Федерации",
    "КТМ": "Кодекс торгового мореплавания Российской Федерации",
    "КВВТ": "Кодекс внутреннего водного транспорта Российской Федерации",
}

# Промпт для извлечения ссылок на НПА
EXTRACTION_SYSTEM_PROMPT = """Ты — юридический эксперт, специализирующийся на анализе нормативно-правовых актов Российской Федерации.

Твоя задача — извлечь из текста ВСЕ ссылки на нормативно-правовые акты (НПА).

ВИДЫ НПА для извлечения:
1. Кодексы РФ (ГК, УК, ТК, НК, АПК, ГПК, УПК, КоАП, СК, ЖК, ЗК и др.)
2. Федеральные законы (ФЗ)
3. Постановления Правительства РФ
4. Указы Президента РФ
5. Приказы федеральных органов исполнительной власти
6. Постановления Пленума ВС РФ
7. Информационные письма ВАС РФ (до 2014 г.)

Для каждой найденной ссылки укажи:
- act_type: тип акта (ГК, УК, ФЗ, ПП_РФ, УП_РФ и т.д.)
- act_name: полное название акта
- article: номер статьи (если применимо)
- part: часть статьи (если указана)
- paragraph: пункт статьи (если указан)
- subparagraph: подпункт (если указан)
- raw_reference: исходный текст ссылки

Ответь ТОЛЬКО в формате JSON:
{
  "npa_references": [
    {
      "act_type": "ГК",
      "act_name": "Гражданский кодекс Российской Федерации",
      "article": "333",
      "part": null,
      "paragraph": "1",
      "subparagraph": null,
      "raw_reference": "п. 1 ст. 333 ГК РФ"
    }
  ]
}

Если НПА не найдено, верни: {"npa_references": []}"""

# Промпт для верификации НПА через Perplexity
VERIFICATION_PROMPT_TEMPLATE = """Проверь актуальность и корректность ссылки на нормативно-правовой акт:

{npa_reference}

ЗАДАЧИ ВЕРИФИКАЦИИ:

1. СУЩЕСТВОВАНИЕ: Проверь, существует ли данная норма
   - Если это статья кодекса — найди её в КонсультантПлюс или Гарант
   - Если это ФЗ — проверь по pravo.gov.ru или consultant.ru

2. АКТУАЛЬНОСТЬ: Проверь текущий статус нормы
   - Действует ли норма в текущей редакции?
   - Были ли изменения в недавнее время?
   - Не утратила ли норма силу?

3. ТЕКСТ НОРМЫ: Если норма существует и действует, приведи её актуальный текст (кратко, основную суть)

4. ИСТОЧНИКИ: Укажи источники, где ты нашёл информацию (ссылки на consultant.ru, garant.ru, pravo.gov.ru)

Ответь в формате JSON:
{{
  "exists": true/false,
  "is_active": true/false,
  "status": "VERIFIED" | "AMENDED" | "REPEALED" | "NOT_FOUND",
  "confidence": "high" | "medium" | "low",
  "current_text": "актуальный текст нормы или null",
  "amendment_info": "информация об изменениях или null",
  "repeal_info": "информация об утрате силы или null",
  "sources": ["список источников"]
}}

ВАЖНО:
- Ищи информацию ТОЛЬКО в официальных правовых базах
- Если не уверен — укажи confidence: "low"
- Если норма изменена — укажи status: "AMENDED" и опиши изменения
- Если норма утратила силу — укажи status: "REPEALED" и дату утраты силы"""


def extract_npa_references_regex(text: str) -> List[NpaReference]:
    """
    Извлечение ссылок на НПА с помощью регулярных выражений.
    Быстрый метод для простых случаев.
    """
    references = []

    # Статьи кодексов: ст. 333 ГК РФ
    pattern1 = r'ст(?:атьи?|\.)\s*(\d+(?:\.\d+)?)\s+([А-ЯЁ]{2,5})\s*РФ'
    for match in re.finditer(pattern1, text, re.IGNORECASE):
        article, code = match.groups()
        code_upper = code.upper()
        references.append(NpaReference(
            act_type=code_upper,
            act_name=CODE_NAMES.get(code_upper, f"{code_upper} РФ"),
            article=article,
            raw_reference=match.group(0)
        ))

    # Части статей: ч. 1 ст. 333 ГК РФ
    pattern2 = r'ч(?:асти?|\.)\s*(\d+)\s+ст(?:атьи?|\.)\s*(\d+(?:\.\d+)?)\s+([А-ЯЁ]{2,5})\s*РФ'
    for match in re.finditer(pattern2, text, re.IGNORECASE):
        part, article, code = match.groups()
        code_upper = code.upper()
        references.append(NpaReference(
            act_type=code_upper,
            act_name=CODE_NAMES.get(code_upper, f"{code_upper} РФ"),
            article=article,
            part=part,
            raw_reference=match.group(0)
        ))

    # Пункты статей: п. 1 ст. 333 ГК РФ
    pattern3 = r'п(?:ункта?|\.)\s*(\d+)\s+ст(?:атьи?|\.)\s*(\d+(?:\.\d+)?)\s+([А-ЯЁ]{2,5})\s*РФ'
    for match in re.finditer(pattern3, text, re.IGNORECASE):
        paragraph, article, code = match.groups()
        code_upper = code.upper()
        references.append(NpaReference(
            act_type=code_upper,
            act_name=CODE_NAMES.get(code_upper, f"{code_upper} РФ"),
            article=article,
            paragraph=paragraph,
            raw_reference=match.group(0)
        ))

    # Подпункты: пп. 1 п. 2 ст. 333 ГК РФ
    pattern4 = r'пп(?:одпункта?|\.)\s*(\d+)\s+п(?:ункта?|\.)\s*(\d+)\s+ст(?:атьи?|\.)\s*(\d+(?:\.\d+)?)\s+([А-ЯЁ]{2,5})\s*РФ'
    for match in re.finditer(pattern4, text, re.IGNORECASE):
        subparagraph, paragraph, article, code = match.groups()
        code_upper = code.upper()
        references.append(NpaReference(
            act_type=code_upper,
            act_name=CODE_NAMES.get(code_upper, f"{code_upper} РФ"),
            article=article,
            paragraph=paragraph,
            subparagraph=subparagraph,
            raw_reference=match.group(0)
        ))

    # Федеральные законы: ФЗ от 08.02.1998 N 14-ФЗ или Федеральный закон от ...
    pattern5 = r'(?:Федеральн(?:ого|ый)\s+закон(?:а)?|ФЗ)\s+от\s+(\d{2}\.\d{2}\.\d{4})\s*[NН№]\s*(\d+(?:-ФЗ)?)'
    for match in re.finditer(pattern5, text, re.IGNORECASE):
        date, number = match.groups()
        references.append(NpaReference(
            act_type="ФЗ",
            act_name=f"Федеральный закон от {date} № {number}",
            article="",
            raw_reference=match.group(0)
        ))

    # Постановления Правительства РФ
    pattern6 = r'[Пп]остановлени[еия]\s+Правительства\s*РФ\s+от\s+(\d{2}\.\d{2}\.\d{4})\s*[NН№]\s*(\d+)'
    for match in re.finditer(pattern6, text):
        date, number = match.groups()
        references.append(NpaReference(
            act_type="ПП_РФ",
            act_name=f"Постановление Правительства РФ от {date} № {number}",
            article="",
            raw_reference=match.group(0)
        ))

    # Указы Президента РФ
    pattern7 = r'[Уу]каз(?:а)?\s+Президента\s*РФ\s+от\s+(\d{2}\.\d{2}\.\d{4})\s*[NН№]\s*(\d+)'
    for match in re.finditer(pattern7, text):
        date, number = match.groups()
        references.append(NpaReference(
            act_type="УП_РФ",
            act_name=f"Указ Президента РФ от {date} № {number}",
            article="",
            raw_reference=match.group(0)
        ))

    # Удаляем дубликаты (по raw_reference)
    seen = set()
    unique_refs = []
    for ref in references:
        if ref.raw_reference not in seen:
            seen.add(ref.raw_reference)
            unique_refs.append(ref)

    return unique_refs


async def extract_npa_references_llm(text: str) -> List[NpaReference]:
    """
    Извлечение ссылок на НПА с помощью LLM.
    Более точный метод для сложных случаев.
    """
    extraction_prompt = f"""Проанализируй текст и извлеки ВСЕ ссылки на нормативно-правовые акты:

ТЕКСТ:
{text[:8000]}  # Ограничиваем размер текста

{EXTRACTION_SYSTEM_PROMPT}"""

    messages = [{"role": "user", "content": extraction_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(
                settings.model_fast,  # Используем быструю модель для извлечения
                messages,
                stream=False,
                max_tokens=2048
            )
        )
        content = response["choices"][0]["message"]["content"]

        # Парсим JSON из ответа
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = json.loads(json_match.group())
            references = []
            for ref_data in data.get("npa_references", []):
                references.append(NpaReference(
                    act_type=ref_data.get("act_type", ""),
                    act_name=ref_data.get("act_name", ""),
                    article=ref_data.get("article", ""),
                    part=ref_data.get("part"),
                    paragraph=ref_data.get("paragraph"),
                    subparagraph=ref_data.get("subparagraph"),
                    raw_reference=ref_data.get("raw_reference", "")
                ))
            return references
    except Exception as e:
        logger.error(f"Error extracting NPA references with LLM: {e}")

    return []


async def verify_npa_reference(reference: NpaReference) -> VerifiedNpa:
    """
    Верификация одной ссылки на НПА через Perplexity.
    """
    # Формируем описание ссылки для верификации
    ref_description = f"{reference.raw_reference}"
    if reference.act_name:
        ref_description += f" ({reference.act_name})"
    if reference.article:
        ref_description += f", статья {reference.article}"
    if reference.part:
        ref_description += f", часть {reference.part}"
    if reference.paragraph:
        ref_description += f", пункт {reference.paragraph}"

    verification_prompt = VERIFICATION_PROMPT_TEMPLATE.format(npa_reference=ref_description)
    messages = [{"role": "user", "content": verification_prompt}]

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat_completion(
                "perplexity/sonar-pro-search",  # Используем Perplexity для поиска
                messages,
                stream=False,
                max_tokens=2048
            )
        )
        content = response["choices"][0]["message"]["content"]

        # Парсим JSON из ответа
        json_match = re.search(r'\{[\s\S]*?\}', content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())

            return VerifiedNpa(
                reference=reference,
                status=data.get("status", "NOT_FOUND"),
                is_active=data.get("is_active", False),
                current_text=data.get("current_text"),
                verification_source="perplexity",
                amendment_info=data.get("amendment_info"),
                repeal_info=data.get("repeal_info"),
                sources=data.get("sources", []),
                confidence=data.get("confidence", "low")
            )
    except Exception as e:
        logger.error(f"Error verifying NPA reference: {e}")

    # Возвращаем NOT_FOUND при ошибке
    return VerifiedNpa(
        reference=reference,
        status="NOT_FOUND",
        is_active=False,
        verification_source="perplexity",
        confidence="low"
    )


async def verify_npa_references(references: List[NpaReference], max_concurrent: int = 3) -> List[VerifiedNpa]:
    """
    Параллельная верификация списка ссылок на НПА.
    """
    if not references:
        return []

    # Ограничиваем количество параллельных запросов
    semaphore = asyncio.Semaphore(max_concurrent)

    async def verify_with_semaphore(ref: NpaReference) -> VerifiedNpa:
        async with semaphore:
            return await verify_npa_reference(ref)

    tasks = [verify_with_semaphore(ref) for ref in references]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    verified = []
    for ref, result in zip(references, results):
        if isinstance(result, Exception):
            logger.error(f"Error verifying {ref.raw_reference}: {result}")
            verified.append(VerifiedNpa(
                reference=ref,
                status="NOT_FOUND",
                is_active=False,
                verification_source="perplexity",
                confidence="low"
            ))
        else:
            verified.append(result)

    return verified


async def extract_and_verify_npa(text: str, use_llm: bool = False) -> List[VerifiedNpa]:
    """
    Основная функция: извлечение и верификация НПА из текста.

    Args:
        text: Текст для анализа
        use_llm: Использовать LLM для извлечения (медленнее, но точнее)

    Returns:
        Список верифицированных НПА
    """
    # Извлекаем ссылки
    if use_llm:
        references = await extract_npa_references_llm(text)
    else:
        references = extract_npa_references_regex(text)

    if not references:
        return []

    # Верифицируем
    verified = await verify_npa_references(references)

    return verified


def generate_npa_link(npa: VerifiedNpa) -> Optional[Dict[str, str]]:
    """
    Генерирует ссылку на НПА в правовых базах.
    """
    ref = npa.reference

    # Для кодексов
    if ref.act_type in CODE_NAMES:
        code_slug = {
            "ГК": "gk",
            "УК": "uk",
            "ТК": "tk",
            "НК": "nk",
            "КоАП": "koap",
            "АПК": "apk",
            "ГПК": "gpk",
            "УПК": "upk",
            "КАС": "kas",
            "СК": "sk",
            "ЖК": "zhk",
            "ЗК": "zk",
        }.get(ref.act_type)

        if code_slug and ref.article:
            return {
                "url": f"https://www.consultant.ru/document/cons_doc_LAW_{code_slug}_st{ref.article}/",
                "label": "КонсультантПлюс",
                "color": "blue"
            }

    # Для федеральных законов
    if ref.act_type == "ФЗ":
        search_query = ref.act_name.replace(" ", "+")
        return {
            "url": f"https://www.consultant.ru/search/?q={search_query}",
            "label": "КонсультантПлюс",
            "color": "blue"
        }

    # Для постановлений Правительства и указов Президента
    if ref.act_type in ["ПП_РФ", "УП_РФ"]:
        search_query = ref.act_name.replace(" ", "+")
        return {
            "url": f"http://pravo.gov.ru/proxy/ips/?searchres=&bpas=cd00000&a3type=1&a3value={search_query}",
            "label": "pravo.gov.ru",
            "color": "green"
        }

    # Общий поиск в Google по юридическим базам
    return {
        "url": f"https://www.google.com/search?q={ref.raw_reference.replace(' ', '+')}+site:consultant.ru+OR+site:garant.ru",
        "label": "Найти",
        "color": "gray"
    }


# Промпт для интеграции в поиск Perplexity (для query.py)
NPA_SEARCH_PROMPT_ADDITION = """

ДОПОЛНИТЕЛЬНО - НОРМАТИВНО-ПРАВОВЫЕ АКТЫ:
При поиске судебной практики также проверь актуальность упоминаемых НПА:
- Проверь, действуют ли статьи кодексов в текущей редакции
- Отметь, если законы были изменены или утратили силу
- Укажи источники (consultant.ru, garant.ru, pravo.gov.ru)

Формат для НПА:
- Норма: [статья и название акта]
- Статус: ДЕЙСТВУЕТ / ИЗМЕНЕНА / УТРАТИЛА СИЛУ
- Актуальный текст: [краткое содержание если изменилась]
- Источник: [ссылка]
"""
