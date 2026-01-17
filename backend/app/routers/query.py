"""
Query router for Single Query mode
Упрощённый режим с двумя моделями (быстрая/думающая) и поиском Perplexity по умолчанию
"""
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum
import json

from app.config import settings
from app.database import (
    validate_session,
    save_chat_message,
    get_chat_history,
    clear_chat_history,
    save_response,
    get_saved_responses,
    delete_saved_response,
    save_usage_stat,
    save_chat_message_to_session
)
import time
from app.services.openrouter import chat_completion_stream
from app.services.docx_generator import create_response_docx
from app.services import perplexity

router = APIRouter(prefix="/api/query", tags=["query"])


# Системный промпт БЕЗ верифицированных дел
LEGAL_SYSTEM_PROMPT = """Ты — опытный российский юрист с глубокими знаниями в области гражданского, корпоративного, экологического, процессуального, административного и трудового законодательства. Твои ответы должны быть оформлены в формате профессиональной аналитической справки.

СТРУКТУРА ОТВЕТА:

1. **Заголовок темы** — кратко обозначь предмет анализа
2. **Нумерованные разделы** — используй арабские цифры (1. 2. 3.)
3. **Заключение/Выводы** — итоговый раздел с практическими рекомендациями

ТИПОВАЯ СТРУКТУРА РАЗДЕЛОВ:

Для правовых вопросов:
1. Существо вопроса
2. Правовое регулирование
3. Правовая оценка / Анализ
4. Риски (если применимо)
5. Выводы

Для судебных споров:
1. Обстоятельства спора
2. Позиции сторон
3. Анализ судебной практики
4. Правовая оценка
5. Выводы и рекомендации

СТИЛЬ ИЗЛОЖЕНИЯ:

- Профессиональный юридический язык без эмоциональной окраски
- Убедительная аргументация через факты и логику
- Структура каждого параграфа: тезис → аргументация → вывод
- Сложные вопросы объясняй доступно, избегая излишних канцеляризмов
- Номера статей и пунктов пиши ТОЛЬКО цифрами (ст. 333 ГК РФ, п. 75)

ФОРМАТИРОВАНИЕ:

- **Ключевые выводы** каждого раздела выделяй жирным (последнее предложение параграфа)
- **Критически важные факты и цифры** выделяй жирным
- **Правовые позиции и нормы** при первом упоминании выделяй жирным
- **Предупреждения о рисках** выделяй жирным
- Прямые цитаты из судебных решений или НПА выделяй курсивом (*цитата*)
- НЕ выделяй: обычные факты, названия организаций, даты и номера дел
- Числовые данные: значительные суммы пиши прописью с цифрами в скобках — «один миллион (1 000 000) рублей»
- Избегай таблиц и сложной markdown-разметки
- Используй буллеты только для перечисления однородных элементов

ПРИНЦИПЫ:

- Каждый раздел должен содержать чёткий тезис
- Отсутствие эмоциональных оценок
- Документ всегда завершается выводами
- Если не уверен в актуальности информации — честно укажи это

Отвечай на русском языке, структурированно и профессионально."""


# Системный промпт С верифицированными делами (шаблон)
LEGAL_SYSTEM_PROMPT_WITH_CASES = """Ты — опытный российский юрист с глубокими знаниями в области гражданского, корпоративного, экологического, процессуального, административного и трудового законодательства. Твои ответы должны быть оформлены в формате профессиональной аналитической справки.

СТРУКТУРА ОТВЕТА:

1. **Заголовок темы** — кратко обозначь предмет анализа
2. **Нумерованные разделы** — используй арабские цифры (1. 2. 3.)
3. **Заключение/Выводы** — итоговый раздел с практическими рекомендациями

ТИПОВАЯ СТРУКТУРА РАЗДЕЛОВ:

Для правовых вопросов:
1. Существо вопроса
2. Правовое регулирование
3. Судебная практика
4. Правовая оценка / Анализ
5. Выводы

Для судебных споров:
1. Обстоятельства спора
2. Позиции сторон
3. Анализ судебной практики
4. Правовая оценка
5. Выводы и рекомендации

СТИЛЬ ИЗЛОЖЕНИЯ:

- Профессиональный юридический язык без эмоциональной окраски
- Убедительная аргументация через факты и логику
- Структура каждого параграфа: тезис → аргументация → вывод
- Сложные вопросы объясняй доступно, избегая излишних канцеляризмов
- Номера статей и пунктов пиши ТОЛЬКО цифрами (ст. 333 ГК РФ, п. 75)

ФОРМАТИРОВАНИЕ:

- **Ключевые выводы** каждого раздела выделяй жирным (последнее предложение параграфа)
- **Критически важные факты и цифры** выделяй жирным
- **Правовые позиции и нормы** при первом упоминании выделяй жирным
- **Предупреждения о рисках** выделяй жирным
- Прямые цитаты из судебных решений или НПА выделяй курсивом (*цитата*)
- НЕ выделяй: обычные факты, названия организаций, даты и номера дел
- Числовые данные: значительные суммы пиши прописью с цифрами в скобках — «один миллион (1 000 000) рублей»
- Избегай таблиц и сложной markdown-разметки
- Используй буллеты только для перечисления однородных элементов

ВЕРИФИЦИРОВАННАЯ СУДЕБНАЯ ПРАКТИКА:
{verified_cases}

ПРАВИЛА РАБОТЫ С СУДЕБНОЙ ПРАКТИКОЙ:

- Используй в ответе ТОЛЬКО дела со статусом VERIFIED — они проверены через официальные базы
- Ссылайся на номера дел точно так, как они указаны выше
- Не выдумывай номера дел — используй только предоставленные
- Цитируй позиции судов, опираясь на информацию из верифицированных дел
- Дела со статусом LIKELY_EXISTS можно упоминать с оговоркой о необходимости проверки
- При ссылке на дело указывай: номер, суд, суть правовой позиции

ПРИНЦИПЫ:

- Каждый раздел должен содержать чёткий тезис
- Отсутствие эмоциональных оценок
- Документ всегда завершается выводами
- Если не уверен в актуальности информации — честно укажи это

Отвечай на русском языке, структурированно и профессионально."""


class QueryMode(str, Enum):
    fast = "fast"
    thinking = "thinking"


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class QueryRequest(BaseModel):
    messages: List[Message]
    mode: QueryMode = QueryMode.fast
    search_enabled: bool = True
    file_context: Optional[str] = None  # Контекст файла (не сохраняется в историю)
    chat_session_id: Optional[str] = None  # ID сессии чата (для новой системы истории)


def get_session_from_token(authorization: str):
    """Extract and validate session from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.replace("Bearer ", "")
    session = validate_session(token)

    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    return session


@router.get("/modes")
async def list_modes(authorization: str = Header(None)):
    """Get available query modes"""
    get_session_from_token(authorization)
    return {
        "modes": [
            {"id": "fast", "name": "Быстрый", "icon": "⚡"},
            {"id": "thinking", "name": "Думающий", "icon": "🧠"}
        ]
    }


@router.post("/single")
async def single_query(
    request: QueryRequest,
    authorization: str = Header(None)
):
    """
    Execute single query with optional Perplexity search.

    Process:
    1. If search_enabled, run Perplexity search first
    2. Select model based on mode (fast/thinking)
    3. Generate response with search context if available
    """
    session = get_session_from_token(authorization)
    user_id = session["user_id"]
    user_name = session.get("users", {}).get("name", "Аноним") if isinstance(session.get("users"), dict) else "Аноним"

    # Get user's question
    user_messages = [m for m in request.messages if m.role == "user"]
    user_query = user_messages[-1].content if user_messages else ""

    # Select model based on mode
    model = settings.model_fast if request.mode == QueryMode.fast else settings.model_thinking
    # Thinking mode needs more tokens for detailed responses
    max_tokens = 8192 if request.mode == QueryMode.thinking else 4096

    # Save user message
    if user_query:
        if request.chat_session_id:
            save_chat_message_to_session(user_id, request.chat_session_id, "user", user_query, model)
        else:
            save_chat_message(user_id, "user", user_query, model)

    async def generate():
        full_response = ""
        search_results = ""
        start_time = time.time()
        success = True
        error_msg = None

        try:
            # Stage 1: Search (if enabled)
            if request.search_enabled and user_query:
                yield f"data: {json.dumps({'stage': 'search', 'message': 'Поиск актуальной информации...'}, ensure_ascii=False)}\n\n"

                try:
                    search_results = perplexity.search(user_query)
                    yield f"data: {json.dumps({'stage': 'search_complete', 'message': 'Поиск завершён'}, ensure_ascii=False)}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'stage': 'search_error', 'message': f'Ошибка поиска: {str(e)}'}, ensure_ascii=False)}\n\n"
                    search_results = ""

            # Stage 2: Generate response
            yield f"data: {json.dumps({'stage': 'generating', 'message': 'Генерация ответа...'}, ensure_ascii=False)}\n\n"

            # Build system prompt
            if search_results:
                system_prompt = LEGAL_SYSTEM_PROMPT_WITH_CASES.format(verified_cases=search_results)
            else:
                system_prompt = LEGAL_SYSTEM_PROMPT

            # Build messages for LLM
            messages = [{"role": "system", "content": system_prompt}]
            for m in request.messages:
                content = m.content
                # Добавляем контекст файла к последнему сообщению пользователя
                if m.role == "user" and m == request.messages[-1] and request.file_context:
                    content = f"[Контекст загруженного файла]\n{request.file_context}\n\n[Вопрос пользователя]\n{m.content}"
                messages.append({"role": m.role, "content": content})

            # Stream response from LLM
            for chunk in chat_completion_stream(model, messages, max_tokens=max_tokens):
                yield f"data: {chunk}\n\n"
                try:
                    parsed = json.loads(chunk)
                    delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    full_response += delta
                except:
                    pass

            yield "data: [DONE]\n\n"

            # Save assistant response
            if full_response:
                if request.chat_session_id:
                    save_chat_message_to_session(user_id, request.chat_session_id, "assistant", full_response, model)
                else:
                    save_chat_message(user_id, "assistant", full_response, model)

        except Exception as e:
            success = False
            error_msg = str(e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

        finally:
            # Save usage statistics
            elapsed_ms = int((time.time() - start_time) * 1000)
            save_usage_stat(
                user_id=user_id,
                user_name=user_name,
                invite_code=None,
                model=model,
                request_type=f"single_query_{request.mode.value}",
                response_time_ms=elapsed_ms,
                tokens_used=len(full_response.split()) if full_response else 0,
                success=success,
                error_message=error_msg
            )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.get("/history")
async def get_history(authorization: str = Header(None)):
    """Get chat history for current user"""
    session = get_session_from_token(authorization)
    user_id = session["user_id"]

    messages = get_chat_history(user_id)
    return {"messages": messages}


@router.delete("/history")
async def delete_history(authorization: str = Header(None)):
    """Clear chat history for current user"""
    session = get_session_from_token(authorization)
    user_id = session["user_id"]

    success = clear_chat_history(user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to clear history")

    return {"success": True}


# Saved responses endpoints

class SaveResponseRequest(BaseModel):
    question: str
    answer: str
    model: Optional[str] = None


@router.post("/saved")
async def save_response_endpoint(
    request: SaveResponseRequest,
    authorization: str = Header(None)
):
    """Save a response to favorites"""
    session = get_session_from_token(authorization)
    user_id = session["user_id"]

    result = save_response(user_id, request.question, request.answer, request.model)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to save response")

    return {"success": True, "id": result["id"]}


@router.get("/saved")
async def get_saved_endpoint(authorization: str = Header(None)):
    """Get saved responses for current user"""
    session = get_session_from_token(authorization)
    user_id = session["user_id"]

    responses = get_saved_responses(user_id)
    return {"responses": responses}


@router.delete("/saved/{response_id}")
async def delete_saved_endpoint(
    response_id: str,
    authorization: str = Header(None)
):
    """Delete a saved response"""
    session = get_session_from_token(authorization)
    user_id = session["user_id"]

    success = delete_saved_response(response_id, user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete response")

    return {"success": True}


# Export endpoints

class ExportDocxRequest(BaseModel):
    question: str
    answer: str
    model: Optional[str] = None


@router.post("/export/docx")
async def export_docx(
    request: ExportDocxRequest,
    authorization: str = Header(None)
):
    """Export response as DOCX file"""
    get_session_from_token(authorization)

    try:
        docx_bytes = create_response_docx(
            question=request.question,
            answer=request.answer,
            model=request.model,
            created_at=datetime.now()
        )

        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": "attachment; filename=sgc-legal-response.docx"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate DOCX: {str(e)}")
