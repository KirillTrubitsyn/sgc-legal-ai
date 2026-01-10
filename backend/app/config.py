from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str

    # Redis
    redis_url: str = ""

    # OpenRouter
    openrouter_api_key: str

    # Google Custom Search API
    google_api_key: str = ""
    google_cx: str = ""  # Search Engine ID

    # LLM Models for Single Query mode
    model_fast: str = "google/gemini-3-flash-preview"
    model_thinking: str = "google/gemini-3-pro-preview"
    model_search: str = "perplexity/sonar-pro"

    # LLM Models for Consilium mode (3-этапная схема)
    model_chairman: str = "anthropic/claude-opus-4.5"      # Этапы 1 и 3
    model_expert_1: str = "openai/gpt-5.2"                 # Этап 1
    model_expert_2: str = "google/gemini-3-pro-preview"    # Этап 1
    model_expert_3: str = "perplexity/sonar-pro-search"    # Этап 1
    model_reviewer: str = "anthropic/claude-sonnet-4"      # Этап 2 (Peer Review)

    # File processing
    model_file_processor: str = "google/gemini-3-flash-preview"

    # File upload
    max_file_size: int = 25 * 1024 * 1024  # 25 MB
    max_audio_duration: int = 300  # 5 minutes in seconds

    # Admin
    admin_password: str = "ADMIN2026"

    # App
    environment: str = "production"
    allowed_origins: str = "http://localhost:3000"
    jwt_secret: str

    class Config:
        env_file = ".env"


settings = Settings()
