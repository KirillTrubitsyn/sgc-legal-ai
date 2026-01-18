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
from app.services.npa_verification import (
    extract_npa_references_regex,
    verify_npa_references,
    NPA_SEARCH_PROMPT_ADDITION
)
from app.services.task_classifier import classify_task, get_task_label, TaskType
from app.services.prompts import get_system_prompt, get_prompt_with_cases

router = APIRouter(prefix="/api/query", tags=["query"])


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
        verified_npa_list = []
        task_type = TaskType.LEGAL_OPINION  # Default
        start_time = time.time()
        success = True
        error_msg = None

        try:
            # Stage 0: Classify task type
            if user_query:
                yield f"data: {json.dumps({'stage': 'classifying', 'message': 'Определение типа задачи...'}, ensure_ascii=False)}\n\n"
                try:
                    task_type = classify_task(
                        user_message=user_query,
                        has_file_context=bool(request.file_context),
                        file_name=None  # TODO: pass file name if available
                    )
                    task_label = get_task_label(task_type)
                    yield f"data: {json.dumps({'stage': 'classified', 'message': f'Режим: {task_label}', 'task_type': task_type.value, 'task_label': task_label}, ensure_ascii=False)}\n\n"
                except Exception as e:
                    # Fallback to legal_opinion on error
                    task_type = TaskType.LEGAL_OPINION
                    yield f"data: {json.dumps({'stage': 'classify_error', 'message': 'Используется режим по умолчанию'}, ensure_ascii=False)}\n\n"

            # Stage 1: Search (if enabled and task type benefits from it)
            # Search is most useful for legal_opinion and general questions
            should_search = request.search_enabled and user_query and task_type in [
                TaskType.LEGAL_OPINION, TaskType.GENERAL, TaskType.DRAFT
            ]
            if should_search:
                yield f"data: {json.dumps({'stage': 'search', 'message': 'Поиск актуальной информации...'}, ensure_ascii=False)}\n\n"

                try:
                    search_results = perplexity.search(user_query + NPA_SEARCH_PROMPT_ADDITION)
                    yield f"data: {json.dumps({'stage': 'search_complete', 'message': 'Поиск завершён'}, ensure_ascii=False)}\n\n"
                except Exception as e:
                    yield f"data: {json.dumps({'stage': 'search_error', 'message': f'Ошибка поиска: {str(e)}'}, ensure_ascii=False)}\n\n"
                    search_results = ""

            # Stage 1.5: Extract and verify NPA from user query (only for legal tasks)
            if task_type in [TaskType.LEGAL_OPINION, TaskType.GENERAL, TaskType.DRAFT]:
                npa_references = extract_npa_references_regex(user_query)
                if npa_references:
                    yield f"data: {json.dumps({'stage': 'npa_verify', 'message': f'Верификация {len(npa_references)} НПА...'}, ensure_ascii=False)}\n\n"
                    try:
                        verified_npa_list = await verify_npa_references(npa_references, max_concurrent=2)
                        yield f"data: {json.dumps({'stage': 'npa_verify_complete', 'message': 'Верификация НПА завершена'}, ensure_ascii=False)}\n\n"
                    except Exception as e:
                        yield f"data: {json.dumps({'stage': 'npa_verify_error', 'message': f'Ошибка верификации НПА: {str(e)}'}, ensure_ascii=False)}\n\n"
                        verified_npa_list = []

            # Stage 2: Generate response
            yield f"data: {json.dumps({'stage': 'generating', 'message': 'Генерация ответа...'}, ensure_ascii=False)}\n\n"

            # Format verified NPA for system prompt
            npa_info = "Информация о НПА не запрашивалась."
            if verified_npa_list:
                npa_lines = []
                for npa in verified_npa_list:
                    status_label = {
                        "VERIFIED": "ДЕЙСТВУЕТ",
                        "AMENDED": "ИЗМЕНЕНА",
                        "REPEALED": "УТРАТИЛА СИЛУ",
                        "NOT_FOUND": "НЕ НАЙДЕНА"
                    }.get(npa.status, npa.status)
                    line = f"- {npa.reference.raw_reference}: {status_label}"
                    if npa.current_text:
                        line += f"\n  Текст: {npa.current_text[:200]}..."
                    if npa.amendment_info:
                        line += f"\n  Изменения: {npa.amendment_info}"
                    if npa.repeal_info:
                        line += f"\n  Утрата силы: {npa.repeal_info}"
                    npa_lines.append(line)
                npa_info = "\n".join(npa_lines)

            # Build system prompt based on task type
            if search_results or verified_npa_list:
                system_prompt = get_prompt_with_cases(
                    task_type=task_type,
                    verified_cases=search_results if search_results else "Судебная практика не запрашивалась.",
                    verified_npa=npa_info
                )
            else:
                system_prompt = get_system_prompt(task_type)

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

            # Send verified NPA to frontend
            if verified_npa_list:
                npa_data = [npa.to_dict() for npa in verified_npa_list]
                yield f"data: {json.dumps({'verified_npa': npa_data}, ensure_ascii=False)}\n\n"

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
                request_type=f"single_query_{request.mode.value}_{task_type.value}",
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
    title: Optional[str] = None  # Custom document title (overrides default)


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
            created_at=datetime.now(),
            title=request.title
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
