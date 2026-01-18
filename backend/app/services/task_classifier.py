"""
Task Classifier Service
Автоматическая классификация типа задачи пользователя для выбора оптимального системного промпта
"""
import logging
from enum import Enum
from typing import Optional
from app.config import settings
from app.services.openrouter import chat_completion

logger = logging.getLogger(__name__)


class TaskType(str, Enum):
    """Типы задач пользователя"""
    LEGAL_OPINION = "legal_opinion"      # Правовое заключение
    SUMMARIZE = "summarize"              # Саммаризация документа
    DRAFT = "draft"                      # Написание документа с нуля
    IMPROVE = "improve"                  # Улучшение/редактирование документа
    REWRITE = "rewrite"                  # Переписывание документа
    GENERAL = "general"                  # Общий вопрос/консультация


# Промпт для классификации задачи
CLASSIFIER_PROMPT = """Ты — классификатор задач. Определи тип задачи пользователя на основе его запроса.

ТИПЫ ЗАДАЧ:
1. legal_opinion — правовой вопрос, анализ ситуации, судебная практика, риски, заключение
2. summarize — краткое изложение документа, выделение главного, создание резюме
3. draft — написание нового документа с нуля (договор, письмо, заявление, жалоба)
4. improve — улучшение существующего текста, редактирование, исправление ошибок
5. rewrite — переписывание текста другими словами, рерайт, перефразирование
6. general — общий вопрос, консультация, объяснение понятий

ПРАВИЛА:
- Если есть загруженный документ И просьба "кратко", "резюме", "главное" — это summarize
- Если просят "написать", "составить", "подготовить" документ — это draft
- Если просят "улучшить", "исправить", "отредактировать" — это improve
- Если просят "переписать", "перефразировать" — это rewrite
- Если правовой вопрос, анализ ситуации, риски — это legal_opinion
- Если просто вопрос или объяснение — это general

Ответь ТОЛЬКО одним словом из списка: legal_opinion, summarize, draft, improve, rewrite, general"""


# Русские названия типов задач для отображения
TASK_TYPE_LABELS = {
    TaskType.LEGAL_OPINION: "Правовое заключение",
    TaskType.SUMMARIZE: "Саммаризация",
    TaskType.DRAFT: "Написание документа",
    TaskType.IMPROVE: "Улучшение документа",
    TaskType.REWRITE: "Переписывание",
    TaskType.GENERAL: "Консультация"
}


def classify_task(
    user_message: str,
    has_file_context: bool = False,
    file_name: Optional[str] = None
) -> TaskType:
    """
    Классифицирует тип задачи на основе запроса пользователя

    Args:
        user_message: Сообщение пользователя
        has_file_context: Есть ли загруженный файл
        file_name: Имя файла (если есть)

    Returns:
        TaskType: Тип задачи
    """
    # Формируем контекст для классификатора
    context = user_message
    if has_file_context:
        file_info = f" (с файлом: {file_name})" if file_name else " (с загруженным документом)"
        context = f"Запрос пользователя{file_info}: {user_message}"

    messages = [
        {"role": "system", "content": CLASSIFIER_PROMPT},
        {"role": "user", "content": context}
    ]

    try:
        response = chat_completion(
            model=settings.model_fast,  # Используем быструю модель
            messages=messages,
            max_tokens=20,  # Нужен только один токен
            stream=False
        )

        result = response.get("choices", [{}])[0].get("message", {}).get("content", "").strip().lower()
        logger.info(f"Task classification result: {result}")

        # Парсим результат
        for task_type in TaskType:
            if task_type.value in result:
                return task_type

        # По умолчанию — правовое заключение (для обратной совместимости)
        logger.warning(f"Unknown task type: {result}, defaulting to legal_opinion")
        return TaskType.LEGAL_OPINION

    except Exception as e:
        logger.error(f"Task classification failed: {e}")
        # При ошибке возвращаем тип по умолчанию
        return TaskType.LEGAL_OPINION


def get_task_label(task_type: TaskType) -> str:
    """Возвращает русское название типа задачи"""
    return TASK_TYPE_LABELS.get(task_type, "Анализ")
