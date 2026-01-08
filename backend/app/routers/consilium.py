"""
Consilium router - Multi-model deliberation endpoints
"""
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
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

        async def on_stage_update(stage: str, message: str):
            await stage_updates.put({"stage": stage, "message": message})

        # Запускаем консилиум в фоне
        task = asyncio.create_task(run_consilium(request.question, on_stage_update))

        # Отправляем обновления стадий
        stages_complete = 0
        while stages_complete < 5:
            try:
                update = await asyncio.wait_for(stage_updates.get(), timeout=60)
                yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
                stages_complete += 1
            except asyncio.TimeoutError:
                yield f"data: {json.dumps({'stage': 'timeout', 'message': 'Превышено время ожидания'})}\n\n"
                break

        # Ждём финальный результат
        try:
            result = await task
            yield f"data: {json.dumps({'stage': 'complete', 'result': result}, ensure_ascii=False)}\n\n"
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
