"""
File processing service for multimodal input
"""
import os
import tempfile
import base64
from typing import Tuple
import docx
import pdfplumber
import requests
from app.config import settings


def detect_file_type(filename: str) -> str:
    """Определить тип файла по расширению"""
    ext = filename.lower().split('.')[-1]

    if ext in ['docx', 'doc']:
        return 'document'
    elif ext == 'pdf':
        return 'pdf'
    elif ext in ['txt', 'md', 'markdown']:
        return 'text'
    elif ext in ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff']:
        return 'image'
    elif ext in ['mp3', 'wav', 'ogg', 'm4a', 'webm']:
        return 'audio'
    else:
        return 'unknown'


def get_audio_mime_type(filename: str) -> str:
    """Получить MIME тип для аудио файла"""
    ext = filename.lower().split('.')[-1]
    mime_types = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        'webm': 'audio/webm'
    }
    return mime_types.get(ext, 'audio/mpeg')


def get_image_mime_type(filename: str) -> str:
    """Получить MIME тип для изображения"""
    ext = filename.lower().split('.')[-1]
    mime_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'tiff': 'image/tiff',
        'webp': 'image/webp'
    }
    return mime_types.get(ext, 'image/png')


async def process_file(file_content: bytes, filename: str) -> Tuple[str, str]:
    """
    Обработать файл и извлечь текст
    Returns: (extracted_text, file_type)
    """
    file_type = detect_file_type(filename)

    if file_type == 'document':
        text = extract_docx(file_content)
    elif file_type == 'pdf':
        text = extract_pdf(file_content)
    elif file_type == 'text':
        text = file_content.decode('utf-8', errors='ignore')
    elif file_type == 'image':
        text = await extract_image_gemini(file_content, filename)
    elif file_type == 'audio':
        text = await transcribe_audio_gemini(file_content, filename)
    else:
        raise ValueError(f"Неподдерживаемый тип файла: {filename}")

    return text, file_type


def extract_docx(content: bytes) -> str:
    """Извлечь текст из DOCX"""
    with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        doc = docx.Document(tmp_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]

        # Также извлекаем текст из таблиц
        for table in doc.tables:
            for row in table.rows:
                row_text = ' | '.join([cell.text.strip() for cell in row.cells if cell.text.strip()])
                if row_text:
                    paragraphs.append(row_text)

        return '\n\n'.join(paragraphs)
    finally:
        os.unlink(tmp_path)


def extract_pdf(content: bytes) -> str:
    """Извлечь текст из PDF"""
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        text_parts = []
        with pdfplumber.open(tmp_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)

                # Извлекаем таблицы
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        row_text = ' | '.join([str(cell) if cell else '' for cell in row])
                        if row_text.strip():
                            text_parts.append(row_text)

        return '\n\n'.join(text_parts)
    finally:
        os.unlink(tmp_path)


async def extract_image_gemini(content: bytes, filename: str) -> str:
    """
    Извлечь текст из изображения через Gemini (OpenRouter)
    Gemini поддерживает изображения как multimodal input
    """
    # Кодируем изображение в base64
    image_base64 = base64.b64encode(content).decode('utf-8')
    mime_type = get_image_mime_type(filename)

    # Формируем запрос к Gemini через OpenRouter
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://sgc-legal-ai.vercel.app",
            "X-Title": "SGC Legal AI"
        },
        json={
            "model": "google/gemini-2.0-flash-001",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Распознай и извлеки весь текст с этого изображения. Выведи только распознанный текст, сохраняя структуру и форматирование. Если текста нет, напиши 'Текст не обнаружен'."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 4096
        },
        timeout=120
    )

    response.raise_for_status()
    result = response.json()

    return result["choices"][0]["message"]["content"]


async def transcribe_audio_gemini(content: bytes, filename: str) -> str:
    """
    Транскрибировать аудио через Gemini (OpenRouter)
    Gemini поддерживает аудио как multimodal input
    """
    # Кодируем аудио в base64
    audio_base64 = base64.b64encode(content).decode('utf-8')
    mime_type = get_audio_mime_type(filename)

    # Формируем запрос к Gemini через OpenRouter
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://sgc-legal-ai.vercel.app",
            "X-Title": "SGC Legal AI"
        },
        json={
            "model": "google/gemini-2.0-flash-001",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Транскрибируй это аудио на русском языке. Выведи только текст транскрипции, без комментариев."
                        },
                        {
                            "type": "audio_url",
                            "audio_url": {
                                "url": f"data:{mime_type};base64,{audio_base64}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 4096
        },
        timeout=120
    )

    response.raise_for_status()
    result = response.json()

    return result["choices"][0]["message"]["content"]


def get_file_summary(text: str, file_type: str, filename: str) -> str:
    """Создать краткое описание загруженного файла"""
    word_count = len(text.split())
    char_count = len(text)

    type_names = {
        'document': 'документ',
        'pdf': 'PDF-документ',
        'text': 'текстовый файл',
        'image': 'изображение (OCR)',
        'audio': 'аудиозапись (транскрипция)'
    }

    type_name = type_names.get(file_type, 'файл')

    return f"Загружен {type_name}: {filename} | {word_count} слов, {char_count} символов"
