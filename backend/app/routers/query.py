"""
Query router for Single Query mode
С автоматическим обогащением ответов через Perplexity Search
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


# Промпт для поиска судебной практики
SEARCH_ENRICHMENT_PROMPT = """Найди актуальную судебную практику и законодательство РФ по теме запроса.

Приоритетные источники:
- kad.arbitr.ru - Картотека арбитражных дел
- sudact.ru - Судебные акты РФ
- vsrf.ru - Верховный Суд РФ
- consultant.ru - КонсультантПлюс
- garant.ru - Гарант
- pravo.gov.ru - Официальный портал правовой информации

Для каждого найденного дела укажи:
- Номер дела
- Суд и дата решения
- Краткую суть позиции

Также укажи релевантные статьи законов и кодексов РФ."""


async def enrich_with_search(query: str) -> Optional[str]:
    """
    Обогащает запрос результатами поиска через Perplexity.
    Возвращает найденную судебную практику и законодательство.
    """
    try:
        search_query = f"{query}\n\n{SEARCH_ENRICHMENT_PROMPT}"
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: web_search(search_query, ""))
        return result.get("content", "")
    except Exception as e:
        print(f"Search enrichment failed: {e}")
        return None


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


@router.post("/single")
async def single_query(
    request: QueryRequest,
    authorization: str = Header(None)
):
    """Execute single query with automatic search enrichment via Perplexity"""
    session = get_session_from_token(authorization)
    user_id = session["user_id"]

    # Get user's question
    user_messages = [m for m in request.messages if m.role == "user"]
    user_query = user_messages[-1].content if user_messages else ""

    # Save user message
    if user_query:
        save_chat_message(user_id, "user", user_query, request.model)

    # Enrich with search results from Perplexity (async)
    # Пропускаем обогащение если выбран сам Perplexity — он сам ищет
    is_perplexity = "perplexity" in request.model.lower()
    search_context = None if is_perplexity else await enrich_with_search(user_query)

    # Build system prompt with search enrichment
    if search_context:
        enriched_system_prompt = f"""{LEGAL_SYSTEM_PROMPT}

РЕЗУЛЬТАТЫ ПОИСКА ПО ТЕМЕ ВОПРОСА:
{search_context}

ВАЖНО: Используй найденную выше судебную практику и ссылки на законодательство в своём ответе.
Указывай номера дел точно так, как они найдены в поиске. Не выдумывай номера дел."""
    else:
        enriched_system_prompt = LEGAL_SYSTEM_PROMPT

    # Convert messages to dict format with enriched system prompt
    messages = [{"role": "system", "content": enriched_system_prompt}]
    messages.extend([{"role": m.role, "content": m.content} for m in request.messages])

    if request.stream:
        # Streaming response
        async def generate():
            full_response = ""
            try:
                for chunk in chat_completion_stream(request.model, messages):
                    yield f"data: {chunk}\n\n"
                    # Parse chunk to accumulate response
                    try:
                        parsed = json.loads(chunk)
                        delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        full_response += delta
                    except:
                        pass
                yield "data: [DONE]\n\n"
                # Save assistant response after streaming completes
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
        # Non-streaming response
        try:
            result = chat_completion(request.model, messages, stream=False)
            content = result["choices"][0]["message"]["content"]
            tokens = result.get("usage", {}).get("total_tokens", 0)

            # Save assistant response
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


class CourtPracticeRequest(BaseModel):
    query: str


@router.post("/court-practice")
async def court_practice_search_endpoint(
    request: CourtPracticeRequest,
    authorization: str = Header(None)
):
    """
    Search for court practice with DaMIA verification.
    Returns verified court cases related to the query.
    """
    session = get_session_from_token(authorization)
    user_id = session["user_id"]

    # Save search query to history
    save_chat_message(user_id, "user", f"[Поиск судебной практики] {request.query}", "court-practice-search")

    # Use queue for stage updates
    stage_queue = asyncio.Queue()

    async def on_stage_update(stage: str, message: str):
        await stage_queue.put({"stage": stage, "message": message})

    async def generate():
        try:
            # Start search in background
            search_task = asyncio.create_task(
                search_court_practice(request.query, on_stage_update)
            )

            # Stream stage updates while search is running
            while not search_task.done():
                try:
                    update = await asyncio.wait_for(stage_queue.get(), timeout=0.1)
                    yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    continue

            # Get final result
            result = await search_task

            # Drain any remaining updates
            while not stage_queue.empty():
                update = await stage_queue.get()
                yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"

            # Send final result
            yield f"data: {json.dumps({'stage': 'complete', 'result': result}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

            # Save result summary to history
            if result:
                verified_count = len([c for c in result.get('verified_cases', []) if c.get('status') == 'VERIFIED'])
                summary = f"Найдено {verified_count} верифицированных дел по теме: {request.query}"
                save_chat_message(user_id, "assistant", summary, "court-practice-search")

        except Exception as e:
            yield f"data: {json.dumps({'stage': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

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
