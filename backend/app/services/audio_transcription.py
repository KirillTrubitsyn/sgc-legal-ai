"""
Audio transcription service using OpenAI Whisper API
Supports long audio files (1-2 hours) by splitting into chunks
"""
import os
import tempfile
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


# Maximum file size for Whisper API (25 MB)
WHISPER_MAX_SIZE = 25 * 1024 * 1024

# Target chunk duration in milliseconds (10 minutes)
CHUNK_DURATION_MS = 10 * 60 * 1000


def get_audio_format(filename: str) -> str:
    """Get audio format from filename"""
    ext = filename.lower().split('.')[-1]
    format_map = {
        'mp3': 'mp3',
        'wav': 'wav',
        'ogg': 'ogg',
        'm4a': 'm4a',
        'webm': 'webm',
        'flac': 'flac',
        'aac': 'aac',
    }
    return format_map.get(ext, 'mp3')


async def transcribe_chunk(
    audio_path: str,
    filename: str = "audio.mp3"
) -> str:
    """Transcribe a single audio chunk using OpenAI Whisper API"""

    if not settings.openai_api_key:
        raise ValueError("OpenAI API key not configured")

    async with httpx.AsyncClient(timeout=300.0) as client:
        with open(audio_path, 'rb') as audio_file:
            files = {
                'file': (filename, audio_file, 'audio/mpeg'),
            }
            data = {
                'model': 'whisper-1',
                'language': 'ru',
                'response_format': 'text',
            }

            response = await client.post(
                'https://api.openai.com/v1/audio/transcriptions',
                headers={
                    'Authorization': f'Bearer {settings.openai_api_key}',
                },
                files=files,
                data=data,
            )

            if response.status_code != 200:
                error_text = response.text
                raise Exception(f"Whisper API error: {response.status_code} - {error_text}")

            return response.text


def split_audio_into_chunks(
    audio_content: bytes,
    filename: str
) -> Tuple[list[str], float]:
    """
    Split audio file into chunks suitable for Whisper API.
    Returns list of temporary file paths and total duration in seconds.
    """
    # Save original audio to temp file
    audio_format = get_audio_format(filename)

    with tempfile.NamedTemporaryFile(suffix=f'.{audio_format}', delete=False) as tmp:
        tmp.write(audio_content)
        tmp_path = tmp.name

    try:
        # Load audio with pydub
        audio = AudioSegment.from_file(tmp_path, format=audio_format)
        duration_seconds = len(audio) / 1000.0

        # If audio is short enough and file size is small, return as single chunk
        if len(audio_content) <= WHISPER_MAX_SIZE:
            return [tmp_path], duration_seconds

        # Split into chunks
        chunk_paths = []
        total_duration = len(audio)

        for i in range(0, total_duration, CHUNK_DURATION_MS):
            chunk = audio[i:i + CHUNK_DURATION_MS]

            # Export chunk to temp file as MP3 (most efficient for API)
            chunk_path = tempfile.mktemp(suffix='.mp3')
            chunk.export(chunk_path, format='mp3', bitrate='64k')

            # Check if chunk is still too large, reduce quality if needed
            if os.path.getsize(chunk_path) > WHISPER_MAX_SIZE:
                os.unlink(chunk_path)
                chunk_path = tempfile.mktemp(suffix='.mp3')
                chunk.export(chunk_path, format='mp3', bitrate='32k')

            chunk_paths.append(chunk_path)

        # Remove original temp file if we created chunks
        if len(chunk_paths) > 1:
            os.unlink(tmp_path)

        return chunk_paths, duration_seconds

    except Exception as e:
        # Clean up on error
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise e


async def transcribe_long_audio(
    audio_content: bytes,
    filename: str
) -> AsyncGenerator[TranscriptionProgress, None]:
    """
    Transcribe long audio file with progress updates.
    Yields TranscriptionProgress objects as transcription progresses.
    """
    chunk_paths = []

    try:
        # Yield preparing stage
        yield TranscriptionProgress(
            stage="preparing",
            progress=0.0,
            message="Подготовка аудио файла..."
        )

        # Split audio into chunks
        chunk_paths, duration_seconds = split_audio_into_chunks(audio_content, filename)
        total_chunks = len(chunk_paths)

        yield TranscriptionProgress(
            stage="preparing",
            progress=0.05,
            message=f"Аудио разделено на {total_chunks} частей. Длительность: {int(duration_seconds // 60)} мин."
        )

        # Transcribe each chunk
        transcripts = []

        for i, chunk_path in enumerate(chunk_paths):
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
                chunk_text = await transcribe_chunk(chunk_path, f"chunk_{i}.mp3")
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

    finally:
        # Clean up temp files
        for path in chunk_paths:
            if os.path.exists(path):
                try:
                    os.unlink(path)
                except:
                    pass


async def transcribe_audio_simple(
    audio_content: bytes,
    filename: str
) -> TranscriptionResult:
    """
    Simple transcription without streaming progress.
    Returns final result.
    """
    chunk_paths = []

    try:
        chunk_paths, duration_seconds = split_audio_into_chunks(audio_content, filename)
        total_chunks = len(chunk_paths)

        transcripts = []
        for chunk_path in chunk_paths:
            chunk_text = await transcribe_chunk(chunk_path, filename)
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

    finally:
        for path in chunk_paths:
            if os.path.exists(path):
                try:
                    os.unlink(path)
                except:
                    pass


def estimate_transcription_time(file_size: int, duration_seconds: float = None) -> str:
    """Estimate transcription time based on file size or duration"""
    # Whisper processes roughly real-time on API
    # Plus some overhead for splitting and API calls

    if duration_seconds:
        minutes = duration_seconds / 60
    else:
        # Estimate based on file size (assume ~1MB per minute for MP3)
        minutes = file_size / (1024 * 1024)

    # Add 20% overhead for processing
    estimated_minutes = minutes * 1.2

    if estimated_minutes < 1:
        return "менее минуты"
    elif estimated_minutes < 5:
        return f"~{int(estimated_minutes)} мин."
    else:
        return f"~{int(estimated_minutes)} мин."
