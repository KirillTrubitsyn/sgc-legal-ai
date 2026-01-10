"""
OpenRouter API client for SGC Legal AI
"""
import requests
import time
import logging
from typing import Optional, Generator
from app.config import settings

logger = logging.getLogger(__name__)


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
    max_tokens: int = 4096,
    reasoning_effort: str = None,
    max_retries: int = 3
) -> dict:
    """
    Send chat completion request to OpenRouter with retry logic

    Args:
        model: Model ID (e.g., "openai/gpt-5.2", "anthropic/claude-opus-4.5")
        messages: List of messages
        stream: Enable streaming
        max_tokens: Maximum tokens in response
        reasoning_effort: Reasoning effort level ("high", "medium", "low", "xhigh")
                         - For GPT-5.2: enables adaptive reasoning
                         - For Claude Opus 4.5: enables extended thinking
        max_retries: Maximum number of retry attempts (default 3)
    """
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": stream
    }

    # Add reasoning/thinking parameters for supported models
    if reasoning_effort:
        if "gpt-5" in model:
            # GPT-5.x uses reasoning parameter with enabled flag
            payload["reasoning"] = {
                "enabled": True,
                "effort": reasoning_effort
            }
        elif "claude-opus" in model:
            # Claude Opus uses extended thinking via budget_tokens
            # Map effort to approximate token budget
            thinking_budgets = {
                "low": 2000,
                "medium": 5000,
                "high": 10000,
                "xhigh": 20000
            }
            budget = thinking_budgets.get(reasoning_effort, 10000)
            payload["thinking"] = {"type": "enabled", "budget_tokens": budget}

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sgc-legal-ai.vercel.app",
        "X-Title": "SGC Legal AI"
    }

    last_error = None
    for attempt in range(max_retries):
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=300  # Increased timeout for thinking models
            )

            # Check for rate limiting or server errors (retry these)
            if response.status_code in [429, 500, 502, 503, 504]:
                wait_time = (2 ** attempt) * 2  # 2s, 4s, 8s
                logger.warning(f"OpenRouter {response.status_code} for {model}, retry {attempt+1}/{max_retries} in {wait_time}s")
                time.sleep(wait_time)
                continue

            response.raise_for_status()
            return response.json()

        except requests.exceptions.Timeout as e:
            last_error = e
            wait_time = (2 ** attempt) * 2
            logger.warning(f"Timeout for {model}, retry {attempt+1}/{max_retries} in {wait_time}s")
            time.sleep(wait_time)
        except requests.exceptions.RequestException as e:
            last_error = e
            # Don't retry client errors (4xx except 429)
            if hasattr(e, 'response') and e.response is not None:
                if 400 <= e.response.status_code < 500 and e.response.status_code != 429:
                    raise
            wait_time = (2 ** attempt) * 2
            logger.warning(f"Request error for {model}: {e}, retry {attempt+1}/{max_retries} in {wait_time}s")
            time.sleep(wait_time)

    # All retries failed
    raise Exception(f"Failed to get response from {model} after {max_retries} attempts: {last_error}")


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
