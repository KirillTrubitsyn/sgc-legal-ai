"""
OpenRouter API client for SGC Legal AI
"""
import requests
from typing import Optional, Generator
from app.config import settings


def get_available_models():
    """Return list of available models"""
    return [
        {
            "id": "anthropic/claude-opus-4.5",
            "name": "Claude Opus 4.5",
            "description": "Флагманская модель Anthropic с расширенными возможностями",
            "price_per_1k": 0.015
        },
        {
            "id": "openai/gpt-5.2",
            "name": "ChatGPT 5.2",
            "description": "Новейшая флагманская модель OpenAI",
            "price_per_1k": 0.01
        },
        {
            "id": "google/gemini-3-pro-preview",
            "name": "Gemini 3.0 Pro Preview",
            "description": "Превью флагманской модели Google",
            "price_per_1k": 0.008
        },
        {
            "id": "google/gemini-3-flash-preview",
            "name": "Gemini 3.0 Flash Preview",
            "description": "Быстрая модель Google для OCR и транскрибации",
            "price_per_1k": 0.002
        },
        {
            "id": "perplexity/sonar-pro-search",
            "name": "Perplexity Sonar Pro",
            "description": "Модель с поиском в интернете",
            "price_per_1k": 0.003
        }
    ]


def chat_completion(
    model: str,
    messages: list,
    stream: bool = False,
    max_tokens: int = 4096
) -> dict:
    """
    Send chat completion request to OpenRouter
    """
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://sgc-legal-ai.vercel.app",
            "X-Title": "SGC Legal AI"
        },
        json={
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "stream": stream
        },
        timeout=120
    )
    response.raise_for_status()
    return response.json()


def chat_completion_stream(
    model: str,
    messages: list,
    max_tokens: int = 4096
) -> Generator[str, None, None]:
    """
    Stream chat completion from OpenRouter
    """
    response = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://sgc-legal-ai.vercel.app",
            "X-Title": "SGC Legal AI"
        },
        json={
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "stream": True
        },
        stream=True,
        timeout=120
    )

    # Handle HTTP errors with readable messages
    if not response.ok:
        try:
            error_data = response.json()
            error_obj = error_data.get("error", {})
            # Handle both dict format {"error": {"message": "..."}} and string format {"error": "..."}
            if isinstance(error_obj, dict):
                error_msg = error_obj.get("message", response.text)
            elif isinstance(error_obj, str):
                error_msg = error_obj
            else:
                error_msg = response.text
        except:
            error_msg = response.text or f"HTTP {response.status_code}"
        raise Exception(f"OpenRouter API error: {error_msg}")

    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                data = line[6:]
                if data == '[DONE]':
                    break
                yield data
