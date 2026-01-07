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
            "id": "anthropic/claude-sonnet-4",
            "name": "Claude Sonnet 4",
            "description": "Быстрая и умная модель Anthropic",
            "price_per_1k": 0.003
        },
        {
            "id": "openai/gpt-4o",
            "name": "GPT-4o",
            "description": "Флагманская модель OpenAI",
            "price_per_1k": 0.005
        },
        {
            "id": "google/gemini-2.0-flash-001",
            "name": "Gemini 2.0 Flash",
            "description": "Быстрая модель Google",
            "price_per_1k": 0.001
        },
        {
            "id": "perplexity/sonar-pro",
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
    response.raise_for_status()

    for line in response.iter_lines():
        if line:
            line = line.decode('utf-8')
            if line.startswith('data: '):
                data = line[6:]
                if data == '[DONE]':
                    break
                yield data
