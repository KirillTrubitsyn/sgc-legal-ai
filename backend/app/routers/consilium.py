"""
Consilium router - Multi-model deliberation endpoints
"""
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
import asyncio

from app.database import validate_session
from app.services.consilium import run_consilium

router = APIRouter(prefix="/api/consilium", tags=["consilium"])


class ConsiliumRequest(BaseModel):
    question: str


class ConsiliumResponse(BaseModel):
    success: bool
    result: dict = None
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


@router.post("/run")
async def run_consilium_endpoint(
    request: ConsiliumRequest,
    authorization: str = Header(None)
):
    """
    Запустить консилиум (non-streaming)
    """
    session = get_session_from_token(authorization)

    try:
        result = await run_consilium(request.question)
        return ConsiliumResponse(success=True, result=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def run_consilium_stream(
    request: ConsiliumRequest,
    authorization: str = Header(None)
):
    """
    Запустить консилиум с потоковыми обновлениями стадий
    """
    session = get_session_from_token(authorization)

    async def generate():
        stage_updates = asyncio.Queue()
        error_holder = {"error": None}

        async def on_stage_update(stage: str, message: str):
            await stage_updates.put({"stage": stage, "message": message})

        async def run_with_error_handling():
            try:
                return await run_consilium(request.question, on_stage_update)
            except Exception as e:
                error_holder["error"] = str(e)
                await stage_updates.put({"stage": "error", "message": str(e)})
                raise

        # Отправляем начальное сообщение
        yield f"data: {json.dumps({'stage': 'starting', 'message': 'Запуск консилиума...'}, ensure_ascii=False)}\n\n"

        # Запускаем консилиум в фоне
        task = asyncio.create_task(run_with_error_handling())

        # Отправляем обновления стадий (5 стадий + возможная ошибка)
        stages_complete = 0
        while stages_complete < 5:
            try:
                # Увеличен таймаут до 180 секунд для стадии 1 (3 LLM вызова)
                update = await asyncio.wait_for(stage_updates.get(), timeout=180)
                yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"

                if update.get("stage") == "error":
                    break

                stages_complete += 1
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'stage': 'timeout', 'message': 'Превышено время ожидания стадии'})}\n\n"
                task.cancel()
                break

        # Ждём финальный результат
        if not task.cancelled() and error_holder["error"] is None:
            try:
                result = await asyncio.wait_for(task, timeout=60)
                yield f"data: {json.dumps({'stage': 'complete', 'result': result}, ensure_ascii=False)}\n\n"
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'stage': 'error', 'message': 'Таймаут финализации'})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'stage': 'error', 'message': str(e)})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
