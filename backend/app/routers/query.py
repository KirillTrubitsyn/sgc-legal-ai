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
    delete_saved_response
)
from app.services.openrouter import chat_completion_stream
from app.services.docx_generator import create_response_docx
from app.services import perplexity

router = APIRouter(prefix="/api/query", tags=["query"])


# Системный промпт БЕЗ поиска
SYSTEM_PROMPT_BASE = """Ты — юридический AI-ассистент Сибирской генерирующей компании (СГК).

СТРУКТУРА ОТВЕТА:
Строй ответ как профессиональную аналитическую справку:
1. Краткий ответ на вопрос (1-2 абзаца)
2. Правовое обоснование
3. Практические рекомендации или выводы

СТИЛЬ ИЗЛОЖЕНИЯ:
- Профессиональный юридический язык без эмоциональной окраски
- Убедительная аргументация через факты и логику
- Структура параграфа: тезис → аргументация → вывод
- Сложные вопросы объясняй доступно, избегая излишних канцеляризмов
- Номера статей и пунктов пиши ТОЛЬКО цифрами (ст. 333 ГК РФ, п. 75)

ВЫДЕЛЕНИЕ ТЕКСТА:
- **Ключевые выводы** выделяй жирным (обычно последнее предложение параграфа)
- **Критические факты и цифры** — жирным
- **Правовые позиции и нормы** — жирным
- *Прямые цитаты из судебных решений или НПА* — курсивом

НЕ ВЫДЕЛЯЙ жирным:
- Обычные факты и описания
- Названия организаций
- Даты и номера дел

ФОРМАТИРОВАНИЕ:
- Используй нумерованные списки для последовательных действий
- Буллеты — для перечисления равнозначных элементов
- Избегай таблиц и сложной markdown-разметки

Отвечай на русском языке, структурированно и профессионально."""


# Системный промпт С поиском (шаблон)
SYSTEM_PROMPT_WITH_SEARCH = """Ты — юридический AI-ассистент Сибирской генерирующей компании (СГК).

СТРУКТУРА ОТВЕТА:
Строй ответ как профессиональную аналитическую справку:
1. Краткий ответ на вопрос (1-2 абзаца)
2. Правовое обоснование
3. Практические рекомендации или выводы

СТИЛЬ ИЗЛОЖЕНИЯ:
- Профессиональный юридический язык без эмоциональной окраски
- Убедительная аргументация через факты и логику
- Структура параграфа: тезис → аргументация → вывод
- Сложные вопросы объясняй доступно, избегая излишних канцеляризмов
- Номера статей и пунктов пиши ТОЛЬКО цифрами (ст. 333 ГК РФ, п. 75)

АКТУАЛЬНАЯ ИНФОРМАЦИЯ ИЗ ПОИСКА:
{search_results}

ПРАВИЛА ИСПОЛЬЗОВАНИЯ РЕЗУЛЬТАТОВ ПОИСКА:
- Ссылайся на найденные судебные дела с указанием номера и сути позиции
- Указывай источник информации (судебная практика, законодательство)
- Если информация противоречива — отметь это
- Свежие изменения законодательства приоритетнее устаревших норм

ВЫДЕЛЕНИЕ ТЕКСТА:
- **Ключевые выводы** выделяй жирным (обычно последнее предложение параграфа)
- **Критические факты и цифры** — жирным
- **Правовые позиции и нормы** — жирным
- *Прямые цитаты из судебных решений или НПА* — курсивом

НЕ ВЫДЕЛЯЙ жирным:
- Обычные факты и описания
- Названия организаций
- Даты и номера дел

ФОРМАТИРОВАНИЕ:
- Используй нумерованные списки для последовательных действий
- Буллеты — для перечисления равнозначных элементов
- Избегай таблиц и сложной markdown-разметки

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

    # Get user's question
    user_messages = [m for m in request.messages if m.role == "user"]
    user_query = user_messages[-1].content if user_messages else ""

    # Select model based on mode
    model = settings.model_fast if request.mode == QueryMode.fast else settings.model_thinking

    # Save user message
    if user_query:
        save_chat_message(user_id, "user", user_query, model)

    async def generate():
        full_response = ""
        search_results = ""

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
                system_prompt = SYSTEM_PROMPT_WITH_SEARCH.format(search_results=search_results)
            else:
                system_prompt = SYSTEM_PROMPT_BASE

            # Build messages for LLM
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend([{"role": m.role, "content": m.content} for m in request.messages])

            # Stream response from LLM
            for chunk in chat_completion_stream(model, messages):
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
                save_chat_message(user_id, "assistant", full_response, model)

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

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
