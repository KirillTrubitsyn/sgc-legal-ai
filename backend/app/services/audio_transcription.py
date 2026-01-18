"""
Audio transcription service using Gemini 3.0 Flash via OpenRouter
Supports long audio files (1-2 hours) by splitting into chunks
"""
import os
import tempfile
import base64
import asyncio
from typing import AsyncGenerator, Tuple, Optional
from dataclasses import dataclass
import httpx
from pydub import AudioSegment

from app.config import settings


@dataclass
class TranscriptionProgress:
    """Progress update for transcription"""
    stage: str  # "preparing", "transcribing", "complete", "error"
    progress: float  # 0.0 to 1.0
    message: str
    chunk_index: Optional[int] = None
    total_chunks: Optional[int] = None
    partial_text: Optional[str] = None


@dataclass
class TranscriptionResult:
    """Final transcription result"""
    success: bool
    text: str
    duration_seconds: float
    chunks_processed: int
    error: Optional[str] = None


# Maximum audio chunk duration for reliable processing (5 minutes)
# Smaller chunks = faster API response, better reliability for large files
CHUNK_DURATION_MS = 5 * 60 * 1000

# Retry settings for API calls
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2

# Gemini model for transcription
TRANSCRIPTION_MODEL = "google/gemini-3-flash-preview"


def get_audio_format(filename: str) -> str:
    """Get audio format from filename"""
    ext = filename.lower().split('.')[-1]
    format_map = {
        'mp3': 'mp3',
        'wav': 'wav',
        'ogg': 'ogg',
        'm4a': 'm4a',
        'mp4': 'mp4',
        'webm': 'webm',
        'flac': 'flac',
        'aac': 'aac',
    }
    return format_map.get(ext, 'mp3')


async def transcribe_chunk_gemini(
    audio_base64: str,
    audio_format: str,
    chunk_index: int = 0,
    total_chunks: int = 1
) -> str:
    """Transcribe a single audio chunk using Gemini via OpenRouter with retry logic"""

    # Build multimodal message with audio using correct input_audio type
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": f"""Транскрибируй это аудио на русском языке.
Это часть {chunk_index + 1} из {total_chunks} аудиозаписи.
Выведи ТОЛЬКО транскрипцию без комментариев, заголовков или пояснений.
Сохраняй разбиение на абзацы по смыслу и при смене говорящего.
Если можешь определить разных говорящих, отмечай их как [Говорящий 1], [Говорящий 2] и т.д.
Если есть неразборчивые места, отмечай их как [неразборчиво]."""
                },
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": audio_base64,
                        "format": audio_format
                    }
                }
            ]
        }
    ]

    last_error = None

    for attempt in range(MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://sgc-legal-ai.vercel.app",
                        "X-Title": "SGC Legal AI"
                    },
                    json={
                        "model": settings.model_file_processor,
                        "messages": messages,
                        "max_tokens": 16000,
                    }
                )

                if response.status_code == 200:
                    result = response.json()
                    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                    return content.strip()

                # Handle rate limiting or server errors with retry
                if response.status_code in [429, 500, 502, 503, 504]:
                    last_error = f"API error {response.status_code}"
                    if attempt < MAX_RETRIES - 1:
                        await asyncio.sleep(RETRY_DELAY_SECONDS * (2 ** attempt))
                        continue

                # Non-retryable error
                error_text = response.text
                raise Exception(f"Gemini API error: {response.status_code} - {error_text}")

        except httpx.TimeoutException:
            last_error = "Таймаут запроса"
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY_SECONDS * (2 ** attempt))
                continue

        except httpx.RequestError as e:
            last_error = f"Ошибка сети: {str(e)}"
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY_SECONDS * (2 ** attempt))
                continue

    raise Exception(f"Не удалось транскрибировать после {MAX_RETRIES} попыток: {last_error}")


def split_audio_into_chunks(
    audio_content: bytes,
    filename: str
) -> Tuple[list[Tuple[str, str]], float]:
    """
    Split audio file into chunks suitable for Gemini API.
    Returns list of (base64_data, audio_format) tuples and total duration in seconds.
    """
    audio_format = get_audio_format(filename)

    with tempfile.NamedTemporaryFile(suffix=f'.{audio_format}', delete=False) as tmp:
        tmp.write(audio_content)
        tmp_path = tmp.name

    try:
        # Load audio with pydub
        audio = AudioSegment.from_file(tmp_path, format=audio_format)
        duration_seconds = len(audio) / 1000.0
        total_duration = len(audio)

        # Supported formats by OpenRouter input_audio
        supported_formats = {'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'aiff'}

        # If audio is short enough, return as single chunk
        if total_duration <= CHUNK_DURATION_MS:
            # Convert to MP3 if format is not supported (e.g., webm)
            if audio_format not in supported_formats:
                chunk_path = tempfile.mktemp(suffix='.mp3')
                audio.export(chunk_path, format='mp3', bitrate='128k')
                with open(chunk_path, 'rb') as f:
                    audio_base64 = base64.b64encode(f.read()).decode('utf-8')
                os.unlink(chunk_path)
                return [(audio_base64, 'mp3')], duration_seconds
            else:
                audio_base64 = base64.b64encode(audio_content).decode('utf-8')
                return [(audio_base64, audio_format)], duration_seconds

        # Split into chunks
        chunks = []

        for i in range(0, total_duration, CHUNK_DURATION_MS):
            chunk = audio[i:i + CHUNK_DURATION_MS]

            # Export chunk to temp file as MP3 (efficient format)
            chunk_path = tempfile.mktemp(suffix='.mp3')
            chunk.export(chunk_path, format='mp3', bitrate='128k')

            # Read and encode to base64
            with open(chunk_path, 'rb') as f:
                chunk_base64 = base64.b64encode(f.read()).decode('utf-8')

            chunks.append((chunk_base64, 'mp3'))

            # Clean up chunk file
            os.unlink(chunk_path)

        return chunks, duration_seconds

    finally:
        # Clean up original temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


async def transcribe_long_audio(
    audio_content: bytes,
    filename: str
) -> AsyncGenerator[TranscriptionProgress, None]:
    """
    Transcribe long audio file with progress updates.
    Yields TranscriptionProgress objects as transcription progresses.
    """
    try:
        # Yield preparing stage
        yield TranscriptionProgress(
            stage="preparing",
            progress=0.0,
            message="Подготовка аудио файла..."
        )

        # Split audio into chunks
        chunks, duration_seconds = split_audio_into_chunks(audio_content, filename)
        total_chunks = len(chunks)

        yield TranscriptionProgress(
            stage="preparing",
            progress=0.05,
            message=f"Аудио подготовлено: {total_chunks} частей, {int(duration_seconds // 60)} мин."
        )

        # Transcribe each chunk
        transcripts = []

        for i, (chunk_base64, audio_format) in enumerate(chunks):
            progress = 0.05 + (0.9 * (i / total_chunks))

            yield TranscriptionProgress(
                stage="transcribing",
                progress=progress,
                message=f"Транскрибация части {i + 1} из {total_chunks}...",
                chunk_index=i + 1,
                total_chunks=total_chunks,
                partial_text="\n\n".join(transcripts) if transcripts else None
            )

            try:
                chunk_text = await transcribe_chunk_gemini(
                    chunk_base64, audio_format, i, total_chunks
                )
                transcripts.append(chunk_text.strip())
            except Exception as e:
                yield TranscriptionProgress(
                    stage="error",
                    progress=progress,
                    message=f"Ошибка при транскрибации части {i + 1}: {str(e)}"
                )
                raise

        # Combine all transcripts
        full_text = "\n\n".join(transcripts)

        yield TranscriptionProgress(
            stage="complete",
            progress=1.0,
            message=f"Транскрибация завершена. {len(full_text.split())} слов.",
            partial_text=full_text
        )

    except Exception as e:
        yield TranscriptionProgress(
            stage="error",
            progress=0,
            message=f"Ошибка: {str(e)}"
        )
        raise


async def transcribe_audio_simple(
    audio_content: bytes,
    filename: str
) -> TranscriptionResult:
    """
    Simple transcription without streaming progress.
    Returns final result.
    """
    try:
        chunks, duration_seconds = split_audio_into_chunks(audio_content, filename)
        total_chunks = len(chunks)

        transcripts = []
        for i, (chunk_base64, audio_format) in enumerate(chunks):
            chunk_text = await transcribe_chunk_gemini(
                chunk_base64, audio_format, i, total_chunks
            )
            transcripts.append(chunk_text.strip())

        full_text = "\n\n".join(transcripts)

        return TranscriptionResult(
            success=True,
            text=full_text,
            duration_seconds=duration_seconds,
            chunks_processed=total_chunks
        )

    except Exception as e:
        return TranscriptionResult(
            success=False,
            text="",
            duration_seconds=0,
            chunks_processed=0,
            error=str(e)
        )


def estimate_transcription_time(file_size: int, duration_seconds: float = None) -> str:
    """Estimate transcription time based on file size or duration"""
    if duration_seconds:
        minutes = duration_seconds / 60
    else:
        # Estimate based on file size (assume ~1MB per minute for MP3)
        minutes = file_size / (1024 * 1024)

    # Gemini processes faster than real-time
    estimated_minutes = minutes * 0.3  # ~30% of audio duration

    if estimated_minutes < 1:
        return "менее минуты"
    elif estimated_minutes < 5:
        return f"~{int(estimated_minutes)} мин."
    else:
        return f"~{int(estimated_minutes)} мин."
