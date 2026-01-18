"""
Transcriptions router for audio transcription CRUD operations
"""
import json
from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

from app.database import (
    validate_session,
    get_invite_code_id_by_user,
    create_transcription,
    get_transcriptions,
    get_transcription,
    update_transcription_title,
    delete_transcription,
    get_transcriptions_count,
    MAX_TRANSCRIPTIONS,
)
from app.services.audio_transcription import (
    transcribe_long_audio,
    TranscriptionProgress,
)
from app.services.file_processor import detect_file_type
from app.config import settings

router = APIRouter(prefix="/api/transcriptions", tags=["transcriptions"])


class TranscriptionMeta(BaseModel):
    id: str
    title: str
    word_count: int
    duration_seconds: float
    filename: Optional[str] = None
    created_at: str


class TranscriptionFull(TranscriptionMeta):
    text: str
    invite_code_id: str


class TranscriptionListResponse(BaseModel):
    transcriptions: List[TranscriptionMeta]
    count: int
    max_allowed: int


class UpdateTitleRequest(BaseModel):
    title: str


def get_session_from_token(authorization: str):
    """Extract and validate session from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.replace("Bearer ", "")
    session = validate_session(token)

    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    return session


def get_invite_code_from_session(session) -> str:
    """Get invite_code_id from session's user"""
    user_id = session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session - no user")

    invite_code_id = get_invite_code_id_by_user(user_id)
    if not invite_code_id:
        raise HTTPException(status_code=401, detail="User has no invite code")

    return invite_code_id


@router.get("/list", response_model=TranscriptionListResponse)
async def list_transcriptions(authorization: str = Header(None)):
    """Get all transcriptions for the current user's invite code"""
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_from_session(session)

    transcriptions = get_transcriptions(invite_code_id)
    count = len(transcriptions)

    return TranscriptionListResponse(
        transcriptions=[TranscriptionMeta(**t) for t in transcriptions],
        count=count,
        max_allowed=MAX_TRANSCRIPTIONS
    )


@router.get("/{transcription_id}", response_model=TranscriptionFull)
async def get_transcription_by_id(
    transcription_id: str,
    authorization: str = Header(None)
):
    """Get a single transcription with full text"""
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_from_session(session)

    transcription = get_transcription(transcription_id)

    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")

    # Verify ownership
    if transcription.get("invite_code_id") != invite_code_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return TranscriptionFull(**transcription)


@router.patch("/{transcription_id}/title")
async def update_title(
    transcription_id: str,
    request: UpdateTitleRequest,
    authorization: str = Header(None)
):
    """Update transcription title"""
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_from_session(session)

    # Verify ownership
    transcription = get_transcription(transcription_id)
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")

    if transcription.get("invite_code_id") != invite_code_id:
        raise HTTPException(status_code=403, detail="Access denied")

    success = update_transcription_title(transcription_id, request.title)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update title")

    return {"success": True}


@router.delete("/{transcription_id}")
async def delete_transcription_by_id(
    transcription_id: str,
    authorization: str = Header(None)
):
    """Delete a transcription"""
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_from_session(session)

    # Verify ownership
    transcription = get_transcription(transcription_id)
    if not transcription:
        raise HTTPException(status_code=404, detail="Transcription not found")

    if transcription.get("invite_code_id") != invite_code_id:
        raise HTTPException(status_code=403, detail="Access denied")

    success = delete_transcription(transcription_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete transcription")

    return {"success": True}


@router.post("/transcribe")
async def transcribe_and_save(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """
    Transcribe audio file and save to database.
    Returns SSE stream with progress and saves result.
    """
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_from_session(session)

    # Check limit
    count = get_transcriptions_count(invite_code_id)
    if count >= MAX_TRANSCRIPTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Достигнут лимит транскрипций ({MAX_TRANSCRIPTIONS}). Удалите старые записи."
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
            detail=f"Неподдерживаемый тип файла: {file.filename}. Загрузите аудио файл."
        )

    async def generate_progress():
        """Generate SSE events with transcription progress"""
        final_text = None
        final_word_count = 0

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
                    final_text = progress.partial_text
                    final_word_count = len(progress.partial_text.split())
                    event_data["text"] = final_text
                    event_data["word_count"] = final_word_count

                yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"

            # Save to database after successful transcription
            if final_text:
                # Generate title from first 50 chars or filename
                title = file.filename.rsplit('.', 1)[0][:50] if file.filename else "Транскрипция"

                saved = create_transcription(
                    invite_code_id=invite_code_id,
                    title=title,
                    text=final_text,
                    word_count=final_word_count,
                    duration_seconds=0,  # Could be calculated from audio
                    filename=file.filename
                )

                if saved:
                    save_event = {
                        "stage": "saved",
                        "transcription_id": saved.get("id"),
                        "title": title
                    }
                    yield f"data: {json.dumps(save_event, ensure_ascii=False)}\n\n"

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
