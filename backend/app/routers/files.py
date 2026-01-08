"""
File upload and processing router
"""
from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from app.database import validate_session
from app.services.file_processor import process_file, detect_file_type, get_file_summary
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
            "images": {
                "extensions": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"],
                "description": "Изображения — распознавание текста (OCR)"
            },
            "audio": {
                "extensions": [".mp3", ".wav", ".ogg", ".m4a", ".webm"],
                "description": "Аудио — транскрибация речи"
            }
        },
        "limits": {
            "max_file_size_mb": settings.max_file_size // (1024 * 1024),
            "max_audio_duration_sec": settings.max_audio_duration
        }
    }
