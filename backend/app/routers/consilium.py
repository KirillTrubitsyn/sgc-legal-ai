"""
Consilium router - Multi-model deliberation endpoints
"""
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
import asyncio
import time

from app.database import validate_session, save_usage_stat
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
    user_id = session["user_id"]
    user_name = session.get("users", {}).get("name", "Аноним") if isinstance(session.get("users"), dict) else "Аноним"
    start_time = time.time()

    async def generate():
        stage_updates = asyncio.Queue()
        task_done = asyncio.Event()
        task_result = {"result": None, "error": None}

        async def on_stage_update(stage: str, message: str):
            await stage_updates.put({"stage": stage, "message": message})

        async def run_task():
            try:
                result = await run_consilium(request.question, on_stage_update)
                task_result["result"] = result
            except Exception as e:
                task_result["error"] = str(e)
            finally:
                task_done.set()
                # Signal end of stages
                await stage_updates.put(None)

        # Отправляем начальное сообщение
        yield f"data: {json.dumps({'stage': 'starting', 'message': 'Запуск консилиума...'}, ensure_ascii=False)}\n\n"

        # Запускаем консилиум в фоне
        asyncio.create_task(run_task())

        # Читаем обновления стадий до завершения задачи
        # Увеличен таймаут до 600s для thinking-моделей (GPT-5.2, Opus 4.5)
        total_timeout = 600  # 10 минут на весь консилиум
        heartbeat_interval = 30  # Отправлять heartbeat каждые 30 секунд
        elapsed = 0

        while elapsed < total_timeout:
            try:
                update = await asyncio.wait_for(stage_updates.get(), timeout=heartbeat_interval)

                if update is None:
                    # Task finished
                    break

                yield f"data: {json.dumps(update, ensure_ascii=False)}\n\n"
                elapsed = 0  # Reset timeout on activity

            except asyncio.TimeoutError:
                elapsed += heartbeat_interval
                # Send heartbeat to keep connection alive
                yield f"data: {json.dumps({'stage': 'heartbeat', 'elapsed': elapsed})}\n\n"

        if elapsed >= total_timeout:
            yield f"data: {json.dumps({'stage': 'timeout', 'message': f'Превышено время ожидания ({total_timeout}s)'})}\n\n"

        # Ждём завершения задачи (должна уже быть завершена)
        try:
            await asyncio.wait_for(task_done.wait(), timeout=10)
        except asyncio.TimeoutError:
            pass

        # Отправляем результат или ошибку
        success = True
        error_msg = None

        if task_result["error"]:
            success = False
            error_msg = task_result["error"]
            yield f"data: {json.dumps({'stage': 'error', 'message': task_result['error']})}\n\n"
        elif task_result["result"]:
            try:
                result_json = json.dumps({'stage': 'complete', 'result': task_result['result']}, ensure_ascii=False)
                yield f"data: {result_json}\n\n"
            except (TypeError, ValueError) as e:
                success = False
                error_msg = f'JSON error: {str(e)}'
                yield f"data: {json.dumps({'stage': 'error', 'message': error_msg})}\n\n"
        else:
            success = False
            error_msg = 'Неизвестная ошибка'
            yield f"data: {json.dumps({'stage': 'error', 'message': error_msg})}\n\n"

        # Save usage statistics
        elapsed_ms = int((time.time() - start_time) * 1000)
        save_usage_stat(
            user_id=user_id,
            user_name=user_name,
            invite_code=None,
            model="consilium_multi_model",
            request_type="consilium",
            response_time_ms=elapsed_ms,
            tokens_used=0,
            success=success,
            error_message=error_msg
        )

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
