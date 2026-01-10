"""
Query router for Single Query mode
С интегрированным поиском и верификацией судебной практики
"""
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json
import asyncio

from app.database import (
    validate_session,
    save_chat_message,
    get_chat_history,
    clear_chat_history,
    save_response,
    get_saved_responses,
    delete_saved_response
)
from app.services.openrouter import (
    get_available_models,
    chat_completion,
    chat_completion_stream
)
from app.services.docx_generator import create_response_docx
from app.services.web_search import web_search_stream, web_search
from app.services.court_practice_search import search_court_practice

router = APIRouter(prefix="/api/query", tags=["query"])

# Системный промпт для юридического ассистента SGC (стиль аналитической справки)
LEGAL_SYSTEM_PROMPT = """Ты — юридический AI-ассистент Сибирской генерирующей компании (СГК).

СТИЛЬ ИЗЛОЖЕНИЯ:
- Профессиональный юридический язык без эмоциональной окраски
- Убедительная аргументация через факты и логику
- Структура параграфа: тезис → аргументация → вывод
- Ключевые выводы выделяй жирным шрифтом (**вывод**)
- Сложные вопросы объясняй доступно, избегая излишних канцеляризмов
- Номера статей и пунктов пиши ТОЛЬКО цифрами (ст. 333 ГК РФ, п. 75)

ФОРМАТИРОВАНИЕ:
- Прямые цитаты из судебных решений или НПА выделяй курсивом (*цитата*)
- **Ключевые выводы** выделяй жирным
- Избегай таблиц и сложной markdown-разметки
- Если не уверен в актуальности информации — честно укажи это

Отвечай на русском языке, структурированно и профессионально."""


# Системный промпт с верифицированной судебной практикой
LEGAL_SYSTEM_PROMPT_WITH_CASES = """Ты — юридический AI-ассистент Сибирской генерирующей компании (СГК).

СТИЛЬ ИЗЛОЖЕНИЯ:
- Профессиональный юридический язык без эмоциональной окраски
- Убедительная аргументация через факты и логику
- Структура параграфа: тезис → аргументация → вывод
- Ключевые выводы выделяй жирным шрифтом (**вывод**)
- Сложные вопросы объясняй доступно, избегая излишних канцеляризмов
- Номера статей и пунктов пиши ТОЛЬКО цифрами (ст. 333 ГК РФ, п. 75)

ФОРМАТИРОВАНИЕ:
- Прямые цитаты из судебных решений или НПА выделяй курсивом (*цитата*)
- **Ключевые выводы** выделяй жирным
- Избегай таблиц и сложной markdown-разметки

ВЕРИФИЦИРОВАННАЯ СУДЕБНАЯ ПРАКТИКА:
{verified_cases}

ВАЖНО:
- Используй в ответе ТОЛЬКО дела со статусом VERIFIED — они проверены через официальные базы
- Ссылайся на номера дел точно так, как они указаны выше
- Не выдумывай номера дел — используй только предоставленные
- Цитируй позиции судов, опираясь на информацию из верифицированных дел
- Дела со статусом LIKELY_EXISTS можно упоминать с оговоркой о необходимости проверки

Отвечай на русском языке, структурированно и профессионально."""


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class QueryRequest(BaseModel):
    model: str
    messages: List[Message]
    stream: bool = True


class QueryResponse(BaseModel):
    success: bool
    content: str = None
    model: str = None
    tokens_used: int = None
    error: str = None


def get_session_from_token(authorization: str):
    """Extract and validate session from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.replace("Bearer ", "")
    session = validate_session(token)

    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    return session


@router.get("/models")
async def list_models(authorization: str = Header(None)):
    """Get list of available models"""
    get_session_from_token(authorization)
    return {"models": get_available_models()}


def format_verified_cases_for_prompt(verified_cases: list) -> str:
    """Форматирует верифицированные дела для включения в промпт"""
    if not verified_cases:
        return "Верифицированных дел не найдено."

    lines = []
    for case in verified_cases:
        status = case.get("status", "UNKNOWN")
        case_num = case.get("case_number", "Без номера")
        court = case.get("court", "")
        date = case.get("date", "")
        summary = case.get("summary", "")
        actual_info = case.get("verification", {}).get("actual_info", "")

        line = f"- [{status}] {case_num}"
        if court:
            line += f" | {court}"
        if date:
            line += f" | {date}"
        if summary:
            line += f"\n  Позиция: {summary}"
        if actual_info:
            line += f"\n  Доп. информация: {actual_info}"
        lines.append(line)

    return "\n".join(lines)


@router.post("/single")
async def single_query(
    request: QueryRequest,
    authorization: str = Header(None)
):
    """
    Execute single query with integrated court practice search and verification.

    Процесс:
    1. Поиск судебной практики через Perplexity
    2. Извлечение номеров дел
    3. Верификация через DaMIA API
    4. Генерация ответа с учётом верифицированных дел
    """
    session = get_session_from_token(authorization)
    user_id = session["user_id"]

    # Get user's question
    user_messages = [m for m in request.messages if m.role == "user"]
    user_query = user_messages[-1].content if user_messages else ""

    # Save user message
    if user_query:
        save_chat_message(user_id, "user", user_query, request.model)

    # Пропускаем верификацию если выбран Perplexity — он сам ищет
    is_perplexity = "perplexity" in request.model.lower()

    if request.stream:
        async def generate():
            full_response = ""
            verified_cases_result = None

            try:
                if not is_perplexity:
                    # Stage 1-3: Поиск и верификация судебной практики
                    stage_queue = asyncio.Queue()

                    async def on_stage_update(stage: str, message: str):
                        await stage_queue.put({"stage": stage, "message": message})

                    # Запускаем поиск судебной практики
                    search_task = asyncio.create_task(
                        search_court_practice(user_query, on_stage_update)
                    )

                    # Отправляем обновления стадий пока идёт поиск
                    while not search_task.done():
                        try:
                            update = await asyncio.wait_for(stage_queue.get(), timeout=0.1)
                            yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
                        except asyncio.TimeoutError:
                            continue

                    # Получаем результат поиска
                    court_practice_result = await search_task

                    # Отправляем оставшиеся обновления из очереди
                    while not stage_queue.empty():
                        update = await stage_queue.get()
                        yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"

                    verified_cases_result = court_practice_result.get("verified_cases", [])

                    # Stage 4: Генерация ответа
                    yield f"data: {json.dumps({'stage': 'generating', 'message': 'Генерация ответа...'}, ensure_ascii=False)}\n\n"

                    # Формируем системный промпт с верифицированными делами
                    if verified_cases_result:
                        cases_text = format_verified_cases_for_prompt(verified_cases_result)
                        system_prompt = LEGAL_SYSTEM_PROMPT_WITH_CASES.format(verified_cases=cases_text)
                    else:
                        system_prompt = LEGAL_SYSTEM_PROMPT
                else:
                    # Для Perplexity используем базовый промпт
                    system_prompt = LEGAL_SYSTEM_PROMPT

                # Формируем сообщения для LLM
                messages = [{"role": "system", "content": system_prompt}]
                messages.extend([{"role": m.role, "content": m.content} for m in request.messages])

                # Стримим ответ от LLM
                for chunk in chat_completion_stream(request.model, messages):
                    yield f"data: {chunk}\n\n"
                    try:
                        parsed = json.loads(chunk)
                        delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        full_response += delta
                    except:
                        pass

                # Отправляем верифицированные дела в конце
                if verified_cases_result:
                    yield f"data: {json.dumps({'verified_cases': verified_cases_result}, ensure_ascii=False)}\n\n"

                yield "data: [DONE]\n\n"

                # Сохраняем ответ ассистента
                if full_response:
                    save_chat_message(user_id, "assistant", full_response, request.model)

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
    else:
        # Non-streaming response (без верификации для простоты)
        try:
            messages = [{"role": "system", "content": LEGAL_SYSTEM_PROMPT}]
            messages.extend([{"role": m.role, "content": m.content} for m in request.messages])

            result = chat_completion(request.model, messages, stream=False)
            content = result["choices"][0]["message"]["content"]
            tokens = result.get("usage", {}).get("total_tokens", 0)

            save_chat_message(user_id, "assistant", content, request.model)

            return QueryResponse(
                success=True,
                content=content,
                model=request.model,
                tokens_used=tokens
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


class SearchRequest(BaseModel):
    query: str
    context: Optional[str] = None
    stream: bool = True


@router.post("/search")
async def web_search_endpoint(
    request: SearchRequest,
    authorization: str = Header(None)
):
    """Execute web search using Perplexity Sonar Pro"""
    session = get_session_from_token(authorization)
    user_id = session["user_id"]

    # Save user search query
    save_chat_message(user_id, "user", f"[Поиск] {request.query}", "perplexity/sonar-pro-search")

    if request.stream:
        async def generate():
            full_response = ""
            try:
                for chunk in web_search_stream(request.query, request.context or ""):
                    yield f"data: {chunk}\n\n"
                    try:
                        parsed = json.loads(chunk)
                        delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        full_response += delta
                    except:
                        pass
                yield "data: [DONE]\n\n"
                # Save search result
                if full_response:
                    save_chat_message(user_id, "assistant", full_response, "perplexity/sonar-pro-search")
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
    else:
        from app.services.web_search import web_search
        try:
            result = web_search(request.query, request.context or "")
            save_chat_message(user_id, "assistant", result["content"], "perplexity/sonar-pro-search")
            return {
                "success": True,
                "content": result["content"],
                "tokens_used": result["tokens"],
                "model": result["model"]
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


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
