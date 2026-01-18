"""
File upload and processing router
"""
import json
from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from app.database import validate_session
from app.services.file_processor import process_file, detect_file_type, get_file_summary
from app.services.audio_transcription import (
    transcribe_long_audio,
    transcribe_audio_simple,
    estimate_transcription_time,
    TranscriptionProgress,
)
from app.config import settings

router = APIRouter(prefix="/api/files", tags=["files"])


class FileUploadResponse(BaseModel):
    success: bool
    file_type: Optional[str] = None
    extracted_text: Optional[str] = None
    summary: Optional[str] = None
    error: Optional[str] = None


def get_session_from_token(authorization: str):
    """Extract and validate session from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.replace("Bearer ", "")
    session = validate_session(token)

    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    return session


@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """
    Загрузить и обработать файл
    Поддерживаемые форматы: DOCX, PDF, TXT, MD, JPG, PNG, MP3, WAV
    """
    session = get_session_from_token(authorization)

    # Проверить размер файла
    content = await file.read()
    if len(content) > settings.max_file_size:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Максимум: {settings.max_file_size // (1024*1024)} МБ"
        )

    # Проверить тип файла
    file_type = detect_file_type(file.filename)
    if file_type == 'unknown':
        raise HTTPException(
            status_code=400,
            detail=f"Неподдерживаемый тип файла: {file.filename}"
        )

    try:
        # Обработать файл
        extracted_text, file_type = await process_file(content, file.filename)

        if not extracted_text or not extracted_text.strip():
            raise HTTPException(
                status_code=422,
                detail="Не удалось извлечь текст из файла"
            )

        summary = get_file_summary(extracted_text, file_type, file.filename)

        return FileUploadResponse(
            success=True,
            file_type=file_type,
            extracted_text=extracted_text,
            summary=summary
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка обработки файла: {str(e)}")


@router.get("/supported")
async def get_supported_formats():
    """Получить список поддерживаемых форматов"""
    return {
        "formats": {
            "documents": {
                "extensions": [".docx", ".doc", ".pdf", ".txt", ".md"],
                "description": "Документы — извлечение текста"
            },
            "spreadsheets": {
                "extensions": [".xlsx", ".xls", ".xlsm"],
                "description": "Таблицы Excel — извлечение данных в markdown"
            },
            "images": {
                "extensions": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"],
                "description": "Изображения — распознавание текста (OCR)"
            },
            "audio": {
                "extensions": [".mp3", ".wav", ".ogg", ".m4a", ".webm"],
                "description": "Аудио — транскрибация речи (до 5 минут)"
            },
            "long_audio": {
                "extensions": [".mp3", ".wav", ".ogg", ".m4a", ".webm", ".flac"],
                "description": "Длинное аудио — транскрибация записей судебных заседаний (до 2 часов)"
            }
        },
        "limits": {
            "max_file_size_mb": settings.max_file_size // (1024 * 1024),
            "max_audio_duration_sec": settings.max_audio_duration,
            "max_long_audio_size_mb": settings.max_long_audio_size // (1024 * 1024),
            "max_long_audio_duration_sec": settings.max_long_audio_duration
        }
    }


class TranscriptionResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    duration_seconds: Optional[float] = None
    chunks_processed: Optional[int] = None
    word_count: Optional[int] = None
    error: Optional[str] = None


@router.post("/transcribe")
async def transcribe_audio_file(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """
    Транскрибировать длинный аудио файл (до 2 часов).
    Использует OpenAI Whisper API.
    Возвращает SSE stream с прогрессом транскрибации.
    """
    session = get_session_from_token(authorization)

    # Check OpenAI API key
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=500,
            detail="Транскрибация недоступна: OpenAI API key не настроен"
        )

    # Read file content
    content = await file.read()

    # Check file size
    if len(content) > settings.max_long_audio_size:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Максимум для аудио: {settings.max_long_audio_size // (1024*1024)} МБ"
        )

    # Check file type
    file_type = detect_file_type(file.filename)
    if file_type != 'audio':
        raise HTTPException(
            status_code=400,
            detail=f"Неподдерживаемый тип файла для транскрибации: {file.filename}. Загрузите аудио файл."
        )

    async def generate_progress():
        """Generate SSE events with transcription progress"""
        try:
            async for progress in transcribe_long_audio(content, file.filename):
                event_data = {
                    "stage": progress.stage,
                    "progress": progress.progress,
                    "message": progress.message,
                }

                if progress.chunk_index is not None:
                    event_data["chunk_index"] = progress.chunk_index
                    event_data["total_chunks"] = progress.total_chunks

                if progress.stage == "complete" and progress.partial_text:
                    event_data["text"] = progress.partial_text
                    event_data["word_count"] = len(progress.partial_text.split())

                yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            error_data = {
                "stage": "error",
                "progress": 0,
                "message": f"Ошибка транскрибации: {str(e)}"
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/transcribe-simple", response_model=TranscriptionResponse)
async def transcribe_audio_simple_endpoint(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """
    Транскрибировать аудио файл без стриминга прогресса.
    Для коротких файлов или когда не нужен прогресс.
    """
    session = get_session_from_token(authorization)

    # Check OpenAI API key
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=500,
            detail="Транскрибация недоступна: OpenAI API key не настроен"
        )

    # Read file content
    content = await file.read()

    # Check file size
    if len(content) > settings.max_long_audio_size:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Максимум: {settings.max_long_audio_size // (1024*1024)} МБ"
        )

    # Check file type
    file_type = detect_file_type(file.filename)
    if file_type != 'audio':
        raise HTTPException(
            status_code=400,
            detail=f"Неподдерживаемый тип файла: {file.filename}"
        )

    result = await transcribe_audio_simple(content, file.filename)

    if not result.success:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка транскрибации: {result.error}"
        )

    return TranscriptionResponse(
        success=True,
        text=result.text,
        duration_seconds=result.duration_seconds,
        chunks_processed=result.chunks_processed,
        word_count=len(result.text.split()) if result.text else 0
    )
